from flask import Flask, render_template, request, jsonify, session, redirect, flash, url_for
import yt_dlp
import sqlite3
import os
import re
import time
from functools import wraps
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv
import bcrypt


load_dotenv()

app = Flask(__name__)

# SECRET_KEY must be set before any session-based route runs.
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
if not app.config["SECRET_KEY"]:
    raise RuntimeError("SECRET_KEY environment variable is not set.")

mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    raise RuntimeError("MONGO_URI environment variable is not set.")

client = MongoClient(mongo_uri)
db = client["groovo"]
users = db["users"]
# Enforce email uniqueness at the DB level to close the check-then-insert race.
users.create_index("email", unique=True)

ydl_opts = {
    "quiet": True,
    "extract_flat": False,
    "noplaylist": True
}

# Simple in-memory cache so the homepage doesn't hit yt_dlp on every load.
# yt_dlp search calls are slow (multiple seconds); trending content doesn't
# need to be second-by-second fresh.
_TRENDING_CACHE = {"data": None, "fetched_at": 0}
_TRENDING_TTL_SECONDS = 60 * 30  # 30 minutes

# -----------------------------
# Per-user SQLite databases
# -----------------------------
# Every account gets its own SQLite file — instance/users/<user_id>.db —
# instead of one shared liked_songs table. This means liked songs are
# actually private per account, and if this repo is forked/deployed by
# many different people, each of their users still only ever sees their
# own library within that deployment.
USERS_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instance", "users")

_USER_ID_PATTERN = re.compile(r"^[0-9a-fA-F]{24}$")  # matches a Mongo ObjectId string


def _is_valid_user_id(user_id):
    """Mongo ObjectIds are always a 24-char hex string. Validating this
    before touching the filesystem stops a tampered/malformed session value
    from being used to build a path."""
    return bool(user_id) and bool(_USER_ID_PATTERN.match(user_id))


def get_user_db_path(user_id):
    if not _is_valid_user_id(user_id):
        raise ValueError("Invalid user id.")
    return os.path.join(USERS_DB_DIR, f"{user_id}.db")


def _init_liked_songs_table(conn):
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS liked_songs (
            video_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            channel TEXT,
            thumbnail TEXT,
            duration INTEGER,
            added_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()


def get_db():
    """Connection to the *currently logged-in user's* personal SQLite
    database. Creates the file (and schema) on first access for that user."""
    user_id = session.get("user")
    if not _is_valid_user_id(user_id):
        raise RuntimeError("get_db() called with no valid user in session.")

    os.makedirs(USERS_DB_DIR, exist_ok=True)
    db_path = get_user_db_path(user_id)
    is_new_file = not os.path.exists(db_path)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    if is_new_file:
        _init_liked_songs_table(conn)

    return conn


def login_required(view):
    """Guards routes that touch a per-user SQLite DB — without a logged-in
    user there's no database file to open."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not _is_valid_user_id(session.get("user")):
            if wants_json_response():
                return jsonify({"success": False, "message": "Please log in."}), 401
            return redirect(url_for("login_page"))
        return view(*args, **kwargs)
    return wrapped


@app.route("/")
def home():
    if "user" not in session:
        return redirect("/login")
    return render_template("index.html")


@app.route("/login")
def login_page():
    return render_template("login.html")


@app.route("/signup")
def signup_page():
    return render_template("signup.html")


def wants_json_response():
    """True if the client explicitly asked for JSON (the login.html AJAX call
    sets Accept: application/json). Plain HTML form posts fall back to
    redirects instead, since there's no JS on the receiving end to handle a
    JSON body."""
    accept = request.headers.get("Accept", "")
    return "application/json" in accept


@app.route("/signup", methods=["POST"])
def signup():
    # signup.html posts as a plain HTML form (no fetch/AJAX), so this follows
    # the Post/Redirect/Get pattern: redirect back to the signup page with a
    # flashed message on failure, or to the homepage on success.
    email = request.form.get("email")
    password = request.form.get("password")

    if not email or not password:
        flash("Email and password are required.", "danger")
        return redirect(url_for("signup_page"))

    if users.find_one({"email": email}):
        flash("Email already registered.", "danger")
        return redirect(url_for("signup_page"))

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    # The signup form only collects email + password, so derive a default
    # username from the email's local part.
    username = email.split("@")[0]

    try:
        result = users.insert_one({
            "username": username,
            "email": email,
            "password": hashed
        })
    except DuplicateKeyError:
        flash("Email already registered.", "danger")
        return redirect(url_for("signup_page"))

    # Log the new user straight in rather than bouncing them to /login.
    session["user"] = str(result.inserted_id)
    return redirect(url_for("home"))


@app.route("/login", methods=["POST"])
def login():
    # login.html submits via fetch() with Accept: application/json and
    # FormData, so this reads form fields and always answers with JSON here.
    email = request.form.get("email")
    password = request.form.get("password")
    as_json = wants_json_response()

    if not email or not password:
        message = "Email and password are required."
        if as_json:
            return jsonify({"success": False, "message": message}), 400
        flash(message, "danger")
        return redirect(url_for("login_page"))

    user = users.find_one({"email": email})

    if not user or not bcrypt.checkpw(password.encode(), user["password"].encode()):
        message = "Invalid email or password."
        if as_json:
            return jsonify({"success": False, "message": message}), 401
        flash(message, "danger")
        return redirect(url_for("login_page"))

    session["user"] = str(user["_id"])

    if as_json:
        return jsonify({"success": True, "redirect": url_for("home")})
    return redirect(url_for("home"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


def run_yt_search(query, limit=50):
    """Run a yt_dlp search and return a list of song dicts. Raises on failure."""
    opts = dict(ydl_opts)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)

    songs = []
    for item in info.get("entries") or []:
        if not item:
            continue
        songs.append({
            "title": item.get("title"),
            "id": item.get("id"),
            "thumbnail": item.get("thumbnail"),
            "duration": item.get("duration"),
            "channel": item.get("uploader")
        })
    return songs


@app.route("/search")
def search():
    query = request.args.get("q")

    if not query:
        return jsonify([])

    try:
        songs = run_yt_search(query, limit=50)
    except Exception as e:
        return jsonify({"success": False, "message": f"Search failed: {e}"}), 502

    return jsonify(songs)


@app.route("/trending")
def trending():
    now = time.time()

    if _TRENDING_CACHE["data"] is not None and (now - _TRENDING_CACHE["fetched_at"]) < _TRENDING_TTL_SECONDS:
        return jsonify(_TRENDING_CACHE["data"])

    try:
        songs = run_yt_search("top trending music hits", limit=20)
    except Exception as e:
        # Serve stale cache if we have it rather than failing the homepage outright.
        if _TRENDING_CACHE["data"] is not None:
            return jsonify(_TRENDING_CACHE["data"])
        return jsonify({"success": False, "message": f"Could not load trending songs: {e}"}), 502

    _TRENDING_CACHE["data"] = songs
    _TRENDING_CACHE["fetched_at"] = now

    return jsonify(songs)


@app.route("/play/<video_id>")
def play(video_id):
    opts = {
        "quiet": True,
        "format": "bestaudio/best"
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}",
                download=False
            )
    except Exception as e:
        return jsonify({"success": False, "message": f"Could not load video: {e}"}), 502

    return jsonify({
        "url": info.get("url"),
        "title": info.get("title")
    })


@app.route("/like", methods=["POST"])
@login_required
def like_song():
    data = request.get_json(silent=True)

    if not data or not data.get("id") or not data.get("title"):
        return jsonify({
            "success": False,
            "message": "id and title are required."
        }), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO liked_songs
            (video_id, title, channel, thumbnail, duration)
            VALUES (?, ?, ?, ?, ?)
        """, (
            data["id"],
            data["title"],
            data.get("channel"),
            data.get("thumbnail"),
            data.get("duration")
        ))
        conn.commit()
    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()

    return jsonify({
        "success": True,
        "message": "Song added to liked songs."
    })


@app.route("/liked")
@login_required
def liked_songs():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT *
            FROM liked_songs
            ORDER BY added_on DESC
        """)
        songs = [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

    return jsonify(songs)


@app.route("/unlike/<video_id>", methods=["DELETE"])
@login_required
def unlike_song(video_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM liked_songs WHERE video_id=?",
            (video_id,)
        )
        conn.commit()
    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()

    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True)
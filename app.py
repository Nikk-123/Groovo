from flask import Flask, render_template, request, jsonify, session, redirect, flash, url_for
import yt_dlp
import sqlite3
import os
import re
import sys
import time
import socket
import threading
from functools import wraps
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv
import bcrypt

def resource_path(relative_path):
    """Resolve a path to a bundled resource.

    In dev this is just relative to app.py. In a PyInstaller --onefile
    build, everything passed via --add-data is unpacked at runtime into a
    temp dir (sys._MEIPASS) -- NOT next to the exe. Flask's default
    template/static folders are relative to app.root_path, which for a
    frozen app resolves to the exe's own directory, so without this,
    render_template() and static files silently 404 in the packaged exe
    even though they work fine with `python app.py`.
    """
    base_path = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_path, relative_path)


# Must point explicitly at the bundled .env location. load_dotenv() with no
# argument searches upward from the current working directory, which in a
# frozen PyInstaller exe is NOT sys._MEIPASS -- so the bundled .env (added
# via --add-data ".env;.") would silently fail to load and every os.getenv()
# below would return None.
load_dotenv(resource_path(".env"))


app = Flask(
    __name__,
    template_folder=resource_path("templates"),
    static_folder=resource_path("static"),
)

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

# extract_flat=True for search listings: we only need id/title/thumbnail/
# duration/channel to render results, not playable stream URLs. With
# extract_flat=False, yt-dlp fully resolves every single search result
# (all ~50 of them) before returning anything, which means it also runs
# YouTube's signature/"n" challenge solver on each one — slow, and any one
# unavailable/challenge-failed video can take the whole search down. Full
# extraction only actually needs to happen for the one video the user picks
# to play, which is handled separately in /play/<video_id>.
ydl_opts = {
    "quiet": True,
    "extract_flat": True,
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


def _best_thumbnail(item):
    """Flat search results usually carry a 'thumbnails' list rather than a
    single 'thumbnail' string, so fall back to the last (highest-res) entry
    in that list when the singular field isn't present."""
    if item.get("thumbnail"):
        return item["thumbnail"]
    thumbs = item.get("thumbnails") or []
    return thumbs[-1]["url"] if thumbs else None


def run_yt_search(query, limit=50):
    """Run a yt_dlp search and return a list of song dicts.

    Uses flat extraction (see ydl_opts) so this only ever hits YouTube's
    search endpoint once and never needs to solve a signature/n challenge
    per result. Individual malformed/unavailable entries are skipped rather
    than failing the whole search, since a single bad item shouldn't take
    down 49 good ones.
    """
    opts = dict(ydl_opts)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)

    songs = []
    for item in info.get("entries") or []:
        if not item or not item.get("id"):
            continue
        try:
            songs.append({
                "title": item.get("title"),
                "id": item.get("id"),
                "thumbnail": _best_thumbnail(item),
                "duration": item.get("duration"),
                "channel": item.get("channel") or item.get("uploader")
            })
        except Exception:
            # Skip anything malformed rather than aborting the whole batch.
            continue
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
    # This is the one place we actually need a resolved stream URL, so it's
    # also the one place signature/n-challenge solving genuinely matters.
    # That solving step is occasionally flaky against a specific video, so
    # retry once before giving up rather than failing on the first hiccup.
    opts = {
        "quiet": True,
        "noplaylist": True,
        "format": "bestaudio/best"
    }

    last_error = None
    for attempt in range(2):
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(
                    f"https://www.youtube.com/watch?v={video_id}",
                    download=False
                )
            if info and info.get("url"):
                return jsonify({
                    "url": info.get("url"),
                    "title": info.get("title")
                })
            last_error = "No playable stream was returned for this video."
        except Exception as e:
            last_error = str(e)
            time.sleep(0.5)

    return jsonify({
        "success": False,
        "message": f"Could not load video: {last_error}"
    }), 502


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


def _find_free_port():
    """Bind to port 0 to let the OS hand back an unused local port, so the
    desktop app never fails to start just because 5000 is taken."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for_server(host, port, timeout=10):
    """Block until the Flask server is actually accepting connections,
    so pywebview isn't pointed at a URL that isn't up yet."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.1)
    return False


def _run_desktop_app():
    """Run Flask in a background thread and open it in a native window via
    pywebview, instead of launching a browser tab. This is what makes the
    PyInstaller-built exe feel like a standalone desktop app."""
    import webview

    host = "127.0.0.1"
    port = _find_free_port()

    server_thread = threading.Thread(
        target=lambda: app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True),
        daemon=True,
    )
    server_thread.start()

    if not _wait_for_server(host, port):
        raise RuntimeError("Local server did not start in time.")

    icon_path = resource_path(os.path.join("static", "icon.ico"))

    webview.create_window(
        "Groovo",
        f"http://{host}:{port}",
        width=1280,
        height=800,
        min_size=(900, 600),
    )
    webview.start(icon=icon_path if os.path.exists(icon_path) else None)


if __name__ == "__main__":
    # DESKTOP_MODE lets you still run `python app.py` as a normal dev server
    # (e.g. DESKTOP_MODE=0 python app.py) when you want browser + hot reload,
    # while the packaged exe always launches the pywebview window.
    desktop_mode = os.getenv("DESKTOP_MODE", "1") == "1" or getattr(sys, "frozen", False)

    if desktop_mode:
        _run_desktop_app()
    else:
        app.run(debug=True)
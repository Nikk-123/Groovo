
# 🎵 Groovo

**Repo:** [github.com/Nikk-123/Groovo](https://github.com/Nikk-123/Groovo)

A Spotify-inspired music streaming web app built with Flask. Search and stream tracks pulled from YouTube via `yt-dlp`, save songs to a personal liked-songs library, browse trending tracks and mood-based mixes, and control playback from a custom mini-player — all in a dark, Spotify-style interface.

> **Note:** Groovo streams audio by resolving YouTube search results through `yt-dlp`. It's built as a learning/portfolio project. See [Legal note](#legal-note) before deploying it publicly.

---

## Features

- 🔐 **Accounts** — email/password signup and login (MongoDB + bcrypt-hashed passwords), session-based auth
- 🔍 **Search** — search any song/artist, results pulled live from YouTube
- 🔥 **Trending rail** — homepage row of currently popular tracks, cached server-side for 30 minutes so it loads instantly
- 🎭 **Mood mixes** — Chill, Party, Focus, Workout, Sad, Happy, Sleep, and Romance mixes, each just a themed search under the hood
- ❤️ **Liked songs** — like/unlike any track; persisted in SQLite and shown in the sidebar
- 🎧 **Custom mini-player** — play/pause, click-or-drag seek bar, volume slider with mute, spacebar shortcut — no native browser `<audio>` UI
- 📱 **Responsive layout** — hamburger-triggered slide-out sidebar, centered search bar, works down to mobile widths
- 💀 **Graceful failure** — search/trending/playback failures return clean error messages instead of crashing the page

---

## Tech stack

| Layer            | Technology                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| Backend          | Flask (Python)                                                              |
| Accounts DB      | MongoDB (via`pymongo`)                                                    |
| Liked-songs DB   | SQLite (`sqlite3`, stdlib)                                                |
| Audio resolution | `yt-dlp`                                                                  |
| Auth             | `bcrypt` password hashing, Flask sessions                                 |
| Frontend         | Vanilla HTML/CSS/JS (dashboard) + Tailwind CSS via CDN (login/signup pages) |
| Icons            | Font Awesome (auth pages)                                                   |

---

## Project structure

```
Groovo/
├── app.py                     # Flask app: routes, auth, yt-dlp search, SQLite liked-songs
├── instance/
│   └── users/
│       ├── <user_id_1>.db      # Liked-songs DB for that account (auto-created on first like)
│       └── <user_id_2>.db      # Every account gets its own isolated SQLite file
├── templates/
│   ├── index.html             # Main dashboard (trending, moods, search, player)
│   ├── login.html             # Login page (Tailwind)
│   └── signup.html            # Signup page (Tailwind)
└── static/
    ├── script.js               # Dashboard logic: search, trending, moods, player, likes
    ├── css/
    │   ├── style.css            # Dashboard styling
    │   ├── auth.css             # (legacy) auth page styling
    │   └── settings.css         # Scrollbars, toggles, settings-overlay styling used by auth pages
    └── js/
        └── auth.js              # (legacy) shared login/signup form handler
```

---

## Prerequisites

- **Python 3.10+**
- **MongoDB** — a running instance (local or [Atlas](https://www.mongodb.com/atlas)) for storing user accounts
- **A JS runtime for yt-dlp** (recommended) — [Deno](https://docs.deno.com/runtime/getting_started/installation) is what `yt-dlp` looks for by default. Without it, YouTube extraction still works but may return fewer/lower-quality audio formats.

---

## Setup

**1. Clone and enter the project**

```bash
git clone https://github.com/Nikk-123/Groovo.git
cd Groovo
```

**2. Create a virtual environment and install dependencies**

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install flask pymongo python-dotenv bcrypt yt-dlp
```

**3. Create a `.env` file** in the project root:

```env
SECRET_KEY=replace-with-a-long-random-string
MONGO_URI=mongodb://localhost:27017
```

Both variables are **required** — the app raises an error on startup if either is missing.

**4. Run the app**

```bash
python app.py
```

Visit **http://127.0.0.1:5000** — you'll be redirected to `/login` until you sign up.

---

## Environment variables

| Variable       | Required | Description                                                          |
| -------------- | -------- | -------------------------------------------------------------------- |
| `SECRET_KEY` | Yes      | Signs Flask session cookies. Use a long random string in production. |
| `MONGO_URI`  | Yes      | Connection string for the MongoDB instance storing user accounts.    |

---

## Per-user databases

Liked songs are **not** stored in one shared table. Every account gets its own SQLite file:

```
instance/users/<mongo_user_id>.db
```

- The file is created automatically (with schema) the first time that account likes a song — nothing to set up manually.
- The `<mongo_user_id>` is validated against the 24-character hex format Mongo `ObjectId`s always take, before it's ever used to build a filesystem path.
- `/like`, `/liked`, and `/unlike` all require an authenticated session (`@login_required`) — there's no "current user" without one, so these routes simply can't run for a logged-out visitor.
- This means if 100 different people are using the same deployment, each of them only ever sees their own liked songs — never anyone else's.
- `instance/` is git-ignored, so these per-user files never get committed to the repo.

---

## API routes

| Method     | Route                  | Description                                                                    |
| ---------- | ---------------------- | ------------------------------------------------------------------------------ |
| `GET`    | `/`                  | Dashboard (redirects to`/login` if not authenticated)                        |
| `GET`    | `/login`             | Login page                                                                     |
| `POST`   | `/login`             | Authenticate; returns JSON if`Accept: application/json`, otherwise redirects |
| `GET`    | `/signup`            | Signup page                                                                    |
| `POST`   | `/signup`            | Create an account (form POST → redirect)                                      |
| `GET`    | `/logout`            | Clear session, redirect home                                                   |
| `GET`    | `/search?q=<query>`  | Search songs via`yt-dlp`                                                     |
| `GET`    | `/trending`          | Cached list of trending tracks                                                 |
| `GET`    | `/play/<video_id>`   | Resolve a playable audio URL for a track                                       |
| `POST`   | `/like`              | Save a track to liked songs                                                    |
| `GET`    | `/liked`             | List all liked songs                                                           |
| `DELETE` | `/unlike/<video_id>` | Remove a track from liked songs                                                |

---

## Known limitations

- **`yt-dlp` is slow and rate-limitable.** Search and mood-mix results depend on live YouTube scraping — under heavy traffic this can be slow or get throttled by YouTube. The `/trending` route is cached for this reason; `/search` is not.
- **No queue / next-previous.** The player supports play, pause, seek, and volume, but there's no "up next" concept yet — that would need a real playlist/queue data model.
- **Per-user databases don't sync across deployments.** Each account's SQLite file lives on whatever machine is running the Flask process. If you fork this repo and deploy it yourself, your users' libraries live only on your deployment — they're not shared with, or visible to, anyone else's fork. This is by design (see below), but worth knowing if you're moving to a multi-server setup, where you'd want these on a shared volume or moved to a proper multi-tenant database instead.

## Legal note

Groovo resolves and streams audio through `yt-dlp` against YouTube search results. This is intended for personal/educational use. Redistributing or publicly hosting a service like this may conflict with YouTube's Terms of Service — review those terms before deploying this beyond local/personal use.

---

## License

Add a license of your choice (MIT is a common default for portfolio projects) — none is currently specified.

---

## Author

Built by [Nikk-123](https://github.com/Nikk-123).

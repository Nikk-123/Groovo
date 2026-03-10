# Groovo — Interview Gist

---

## 1. Login System & Session Management

> "We use a **session-based authentication system**. The user enters their email and password on the login screen. The credentials are sent to our **Flask-based auth microservice**, which is deployed separately on Render. The service queries **MongoDB Atlas** to find the user, and verifies the password using **bcrypt hashing**.
>
> On successful authentication, the user's email is stored in a **Flask session** — which is a signed cookie sent to the browser. This cookie is automatically attached to every subsequent request, so the server knows who the user is without requiring re-authentication.
>
> Every protected route (dashboard, library, settings) checks `session['user_id']`. If it's missing, the user is redirected to the login page.
>
> The user's **music library** is stored as an array of song objects in MongoDB, inside the user's document. On login, the library is returned in the response and cached on the client side — in `localStorage` for the desktop app, and in a local **Room (SQLite) database** on Android. Library operations like add/remove are synced back to MongoDB via API calls."

### Follow-up questions:

| Question | Answer |
|----------|--------|
| Why not JWT? | Flask sessions were sufficient for our single-server desktop app. JWT would help if we had multiple microservices that need stateless auth. |
| Is the cookie secure? | It's **signed** (tamper-proof) using Flask's `secret_key`, but not encrypted — the email is readable. For production, we'd use HTTPS and `HttpOnly` flags. |
| How does Android handle sessions? | Android stores the email in SharedPreferences and sends it via `X-User-Email` header on API calls. |
| What happens if the session expires? | The cookie loses its validity. The next request won't have `session['user_id']`, so the user gets redirected to login. |
| Why bcrypt and not SHA-256? | bcrypt is deliberately slow and includes a salt, making brute-force and rainbow table attacks impractical. SHA-256 is fast — which is bad for password hashing. |
| How is the library synced between devices? | The library lives in MongoDB. Desktop caches it in `localStorage`, Android syncs it to a local Room DB. Any add/remove operation calls the API, which updates MongoDB — so it's always the source of truth. |
| What if MongoDB is down during login? | The [get_user_by_email](file:///c:/Users/chaya/OneDrive/Desktop/PERSONAL/TEST/Groovo/services/authentication/auth.py#55-61) function catches `PyMongoError` and returns `None`, which results in a "User not found" response. We also have a `serverSelectionTimeoutMS=5000` to fail fast. |

---

## 2. What is yt-dlp?

> "**yt-dlp** is an open-source Python library and command-line tool for extracting information and downloading content from YouTube and other video platforms. It's a fork of `youtube-dl` with better performance and more features.
>
> In Groovo, we use yt-dlp **only for metadata and URL extraction** — we never download any audio files. It gives us the ability to search YouTube, fetch video details (title, thumbnail, duration, artist), and most importantly, extract **direct audio stream URLs** from YouTube's CDN — all without needing a YouTube API key."

### Follow-up questions:

| Question | Answer |
|----------|--------|
| Why yt-dlp and not YouTube's official API? | YouTube's Data API gives metadata but not direct audio stream URLs. yt-dlp can extract the actual playable stream URL, letting us build a custom player without YouTube's iframe. Also, the official API has quota limits. |
| Is yt-dlp legal? | yt-dlp itself is legal open-source software. We only extract metadata and stream URLs — we don't download or redistribute copyrighted content. The audio streams directly from YouTube's own servers. |
| What if YouTube changes their page structure? | yt-dlp has an active community that pushes frequent updates to handle YouTube changes. We just need to update the yt-dlp package version. |

---

## 3. How Songs Are Played

> "When a user clicks a song, the frontend sends the YouTube video URL to our backend via `POST /play`. The backend uses yt-dlp to **extract the direct audio stream URL** — this is a URL pointing to YouTube's own CDN servers where the actual audio file is hosted.
>
> yt-dlp does **not** download the audio. It runs `extract_info(url, download=False)` which only resolves the metadata. From the response, we pick the best audio-only format (preferring HTTPS protocol and highest bitrate).
>
> This direct stream URL is sent back to the frontend as JSON. The browser then plays it using the **HTML5 `<audio>` element**, streaming directly from YouTube's servers. Our server acts purely as a **URL resolver** — it's never in the media streaming path."

**One-liner:** *yt-dlp finds the address, the browser plays the music.*

### Follow-up questions:

| Question | Answer |
|----------|--------|
| Do the stream URLs expire? | Yes, YouTube's CDN URLs have an `expire` parameter and typically last a few hours. If a URL expires mid-session, the user would need to click play again to get a fresh URL. |
| Why audio-only and not video? | We're a music app, so we filter for audio-only formats (`vcodec=none, acodec!=none`). This saves bandwidth — audio streams are much smaller than video. |
| What if yt-dlp fails to extract? | We try multiple format candidates in order: `bestaudio[protocol^=https]` → `bestaudio/best` → `best`. If all fail, we return an error JSON to the frontend. |
| Does the server stream the audio? | No. The server only resolves the URL. The browser streams directly from YouTube's CDN — our server is never in the media path, so there's no bandwidth cost on our side. |
| How does Android play songs? | Android uses the same concept — it gets the stream URL from the backend and plays it using **ExoPlayer** (a media player library by Google), not the HTML5 audio element. |

---

## 4. How Search Works

> "When the user types a query, the frontend sends `GET /search?query=<text>` to our backend. We use yt-dlp's `ytsearch` feature — `ytsearch25:<query> music` — which programmatically queries YouTube's search engine and returns up to 25 results.
>
> We use `extract_flat=True` so yt-dlp only fetches lightweight metadata (no deep resolution of each video), making it fast. For each result, we extract title, thumbnail URL, duration, view count, and artist name.
>
> For artist parsing, we check if the video title contains a hyphen (e.g., 'Arijit Singh - Tum Hi Ho'). If so, we split it to get the artist and song name separately. Otherwise, we fall back to the YouTube channel name.
>
> **Trending** works the same way — it's just a search for `'trending music 2025 latest hits'` returning 25 results. **Mood playlists** use predefined search queries (e.g., 'chill lofi music playlist') with 7 results per mood, fetched in parallel using `ThreadPoolExecutor` with 10 workers."

### Follow-up questions:

| Question | Answer |
|----------|--------|
| Why 25 results? | `ytsearch25` is a good balance — enough variety for the user without making the request too slow. The number is configurable. |
| What does `extract_flat=True` do? | Normally yt-dlp resolves each video fully (formats, streams, etc). `extract_flat` skips that and only gets surface-level metadata — making search 5-10x faster. |
| How is the trending section different from search? | Technically it's the same mechanism — just a hardcoded search query (`'trending music 2025 latest hits'`). We're using YouTube's search relevance to approximate trending content. |
| Why fetch mood playlists in parallel? | We have 10 moods, each requiring a separate YouTube search. Sequential fetching would take ~30+ seconds. Using `ThreadPoolExecutor(max_workers=10)` fetches all 10 in parallel, reducing it to ~3-5 seconds. |
| What if a search returns no results? | yt-dlp returns an empty `entries` list. We handle this gracefully — the frontend just shows no results. For mood playlists, we ensure every mood key exists even if empty, to prevent template errors. |

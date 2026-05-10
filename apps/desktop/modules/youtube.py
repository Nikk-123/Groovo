"""
YouTube/music fetching module for Groovo application.
Handles all YT-DLP operations for fetching songs, playlists, and trending music.
"""

import logging
from yt_dlp import YoutubeDL
from concurrent.futures import ThreadPoolExecutor, as_completed


# Mood query mappings
MOOD_QUERIES = {
    'Happy':           'happy upbeat music playlist',
    'Chill':           'chill lofi music playlist',
    'Workout':         'workout motivation music playlist',
    'Focus':           'focus study music playlist',
    'Party':           'party hits music playlist',
    'Bollywood Party': 'latest bollywood dance hits playlist',
    'Classical':       'indian classical music playlist',
    'Bhakti':          'popular bhakti songs playlist',
    'Romantic':        'bollywood romantic songs playlist',
    'Punjabi':         'latest punjabi hits playlist',
}


# ── Cookie browser probe ──────────────────────────────────────────────────────
# Chrome 127+ uses App-Bound Encryption (DPAPI v2) which yt-dlp cannot decrypt
# without elevated privileges (see github.com/yt-dlp/yt-dlp/issues/10927).
# We probe Firefox → Edge → Chrome in order and cache the result for the session.
# If no browser works we fall back to cookie-free mode; the android/ios innertube
# client handles most content without authentication.
# ─────────────────────────────────────────────────────────────────────────────

_COOKIE_BROWSER    = None   # populated by _probe_cookie_browser()
_COOKIE_PROBE_DONE = False  # ensures the probe runs only once per session

_BROWSER_CANDIDATES = [
    ('firefox', None, None, None),  # Firefox: PBKDF2 — always readable by yt-dlp
    ('edge',    None, None, None),  # Edge:    usually readable on Windows
    ('chrome',  None, None, None),  # Chrome:  blocked on 127+ without elevation
]


def _probe_cookie_browser():
    """
    Run once at first use: find the first browser whose cookies yt-dlp can read.
    Returns a (browser, profile, keyring, container) tuple, or None.
    """
    global _COOKIE_BROWSER, _COOKIE_PROBE_DONE
    if _COOKIE_PROBE_DONE:
        return _COOKIE_BROWSER

    _COOKIE_PROBE_DONE = True

    probe_opts = {
        'quiet':         True,
        'no_warnings':   True,
        'extract_flat':  True,
        'ignoreerrors':  True,
        'skip_download': True,
    }

    for browser_tuple in _BROWSER_CANDIDATES:
        try:
            opts = {**probe_opts, 'cookiesfrombrowser': browser_tuple}
            with YoutubeDL(opts) as ydl:
                # extract_info triggers the actual cookie-load; a short known
                # video is used so the probe completes quickly.
                ydl.extract_info(
                    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
                    download=False,
                )
            logging.info("[Groovo] Cookie source: %s", browser_tuple[0])
            _COOKIE_BROWSER = browser_tuple
            return _COOKIE_BROWSER

        except Exception as e:
            err = str(e).lower()
            if 'failed to load cookies' in err or 'dpapi' in err or 'decrypt' in err:
                logging.warning(
                    "[Groovo] %s cookies unavailable: %s", browser_tuple[0], e
                )
                continue
            # Any other exception means the cookie loading itself succeeded
            # (the error is from something else, e.g. network).
            logging.info("[Groovo] Cookie source: %s", browser_tuple[0])
            _COOKIE_BROWSER = browser_tuple
            return _COOKIE_BROWSER

    logging.warning("[Groovo] No browser cookies available — using cookie-free mode.")
    _COOKIE_BROWSER = None
    return None


def _build_opts(extra: dict | None = None) -> dict:
    """
    Build a complete yt-dlp options dict.
    Adds the probed cookie browser automatically (if one is available),
    then applies any caller-supplied overrides.
    """
    opts = {
        'quiet':              True,
        'no_warnings':        True,
        'extract_flat':       True,
        'ignoreerrors':       True,
        'geo_bypass':         True,
        'nocheckcertificate': True,
        'socket_timeout':     30,
        'source_address':     '',
        'extractor_args': {
            'youtube': {
                # android/ios clients bypass PO-token checks that block web client
                'player_client': ['android', 'ios', 'web'],
            }
        },
        'http_headers': {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/131.0.0.0 Safari/537.36'
            ),
            'Accept':          '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer':         'https://www.youtube.com/',
        },
    }

    cookie_browser = _probe_cookie_browser()
    if cookie_browser:
        opts['cookiesfrombrowser'] = cookie_browser

    if extra:
        opts.update(extra)

    return opts


def _extract_info(ydl_opts: dict, url: str, download: bool = False):
    """
    Safe wrapper around YoutubeDL.extract_info.
    If the call fails because of a cookie-load / DPAPI error, it automatically
    retries without the cookiesfrombrowser option so playback is never blocked
    by Chrome's App-Bound Encryption issue (yt-dlp #10927).
    """
    try:
        with YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=download)

    except Exception as e:
        err = str(e).lower()
        if 'failed to load cookies' in err or 'dpapi' in err or 'decrypt' in err:
            logging.warning(
                "[Groovo] Cookie error during extract; retrying without cookies. (%s)", e
            )
            fallback_opts = {k: v for k, v in ydl_opts.items()
                             if k != 'cookiesfrombrowser'}
            with YoutubeDL(fallback_opts) as ydl:
                return ydl.extract_info(url, download=download)
        raise


# ── Private helpers ───────────────────────────────────────────────────────────

def _best_thumbnail(thumbnails: list) -> str:
    """Return the best thumbnail URL (height >= 180 preferred, else first)."""
    if not thumbnails:
        return ''
    for thumb in thumbnails:
        if thumb.get('height', 0) >= 180:
            return thumb['url']
    return thumbnails[0].get('url', '')


def _format_duration(duration) -> str:
    """Convert seconds to M:SS string, or 'Unknown'."""
    if duration:
        return f"{int(duration) // 60}:{int(duration) % 60:02d}"
    return 'Unknown'


# ── Public API ────────────────────────────────────────────────────────────────

def fetch_single_mood(mood: str, search_query: str, ydl_opts: dict, playlist_size: int):
    """
    Fetch songs for a single mood using the given ydl_opts.
    Returns (mood, [song_dict, ...]).
    Always uses 'artist' key (not 'channel') for frontend consistency.
    """
    try:
        info = _extract_info(ydl_opts, f'ytsearch{playlist_size}:{search_query}')
        songs = []
        for entry in (info or {}).get('entries', []):
            if not entry or not entry.get('id'):
                continue
            songs.append({
                'title':     entry.get('title', 'Unknown Title'),
                'url':       f"https://www.youtube.com/watch?v={entry['id']}",
                'thumbnail': _best_thumbnail(entry.get('thumbnails') or []),
                'artist': (
                    entry.get('channel')
                    or entry.get('uploader')
                    or 'Unknown Artist'
                ),
                'duration': _format_duration(entry.get('duration')),
            })
        return mood, songs

    except Exception as e:
        logging.error("[youtube] Error fetching mood '%s': %s", mood, e)
        return mood, []


def fetch_mood_playlists(playlist_size: int = 7) -> dict:
    """Fetch playlists for all moods in parallel."""
    ydl_opts = _build_opts()
    mood_playlists = {}

    try:
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {
                executor.submit(
                    fetch_single_mood, mood, query, ydl_opts, playlist_size
                ): mood
                for mood, query in MOOD_QUERIES.items()
            }
            for future in as_completed(futures):
                mood, songs = future.result()
                mood_playlists[mood] = songs

        for mood in MOOD_QUERIES:
            mood_playlists.setdefault(mood, [])

        return mood_playlists

    except Exception as e:
        logging.error("[youtube] Error in fetch_mood_playlists: %s", e)
        return {k: [] for k in MOOD_QUERIES}


def fetch_trending() -> list:
    """Fetch trending music tracks."""
    ydl_opts = _build_opts()

    try:
        info = _extract_info(ydl_opts, 'ytsearch25:trending music 2025 latest hits')
        trending = []
        for entry in (info or {}).get('entries', []):
            if not entry or not entry.get('id'):
                continue

            full_title = entry.get('title', '')
            artist     = entry.get('uploader', '')

            if not artist or artist == 'Unknown Artist':
                parts = full_title.split('-', 1)
                if len(parts) > 1:
                    artist = parts[0].strip()
                    title  = parts[1].strip()
                else:
                    artist = entry.get('channel', 'Unknown Artist')
                    title  = full_title
            else:
                title = full_title

            trending.append({
                'title':     title,
                'url':       f"https://www.youtube.com/watch?v={entry['id']}",
                'artist':    artist,
                'thumbnail': _best_thumbnail(entry.get('thumbnails') or []),
                'duration':  _format_duration(entry.get('duration')),
            })

        return trending

    except Exception as e:
        logging.error("[youtube] Error fetching trending: %s", e)
        return [
            {
                'title':     'Popular Music',
                'url':       'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'artist':    'Various Artists',
                'thumbnail': 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                'duration':  'Unknown',
            }
        ]
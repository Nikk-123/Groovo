"""
YouTube/music fetching module for Groovo application.
Handles all YT-DLP operations for fetching songs, playlists, and trending music.
"""

from yt_dlp import YoutubeDL
from concurrent.futures import ThreadPoolExecutor, as_completed


# Mood query mappings
MOOD_QUERIES = {
    'Happy': 'happy upbeat music playlist',
    'Chill': 'chill lofi music playlist',
    'Workout': 'workout motivation music playlist',
    'Focus': 'focus study music playlist',
    'Party': 'party hits music playlist',
    'Bollywood Party': 'latest bollywood dance hits playlist',
    'Classical': 'indian classical music playlist',
    'Bhakti': 'popular bhakti songs playlist',
    'Romantic': 'bollywood romantic songs playlist',
    'Punjabi': 'latest punjabi hits playlist'
}


def _best_thumbnail(thumbnails):
    """Return the best thumbnail URL from a thumbnails list (height >= 180 preferred)."""
    if not thumbnails:
        return ''
    for thumb in thumbnails:
        if thumb.get('height', 0) >= 180:
            return thumb['url']
    return thumbnails[0].get('url', '')


def _format_duration(duration):
    """Convert seconds to M:SS string."""
    if duration:
        minutes = int(duration) // 60
        seconds = int(duration) % 60
        return f"{minutes}:{seconds:02d}"
    return "Unknown"


def fetch_single_mood(mood, search_query, ydl_opts, playlist_size):
    """Fetch songs for a single mood.

    Always returns the 'artist' key (not 'channel') so the frontend
    and all API consumers have a single consistent field name.
    """
    try:
        with YoutubeDL(ydl_opts) as ydl:
            full_query = f'ytsearch{playlist_size}:{search_query}'
            info = ydl.extract_info(full_query, download=False)
            playlist_songs = []

            for entry in info.get('entries', []):
                if not entry:
                    continue
                # Skip entries without a video ID — they cannot be played
                if not entry.get('id'):
                    continue

                song = {
                    'title': entry.get('title', 'Unknown Title'),
                    'url': f"https://www.youtube.com/watch?v={entry['id']}",
                    'thumbnail': _best_thumbnail(entry.get('thumbnails', [])),
                    # Standardized to 'artist' — was previously 'channel'
                    'artist': entry.get('channel') or entry.get('uploader') or 'Unknown Artist',
                    'duration': _format_duration(entry.get('duration')),
                }
                playlist_songs.append(song)

            return mood, playlist_songs
    except Exception as mood_error:
        print(f"Error fetching playlist for mood '{mood}': {mood_error}")
        return mood, []


def fetch_mood_playlists(playlist_size=7):
    """Fetch playlists for all moods in parallel."""
    mood_playlists = {}

    ydl_opts = {
        'format': 'bestaudio',
        'quiet': True,
        'extract_flat': True,
        'geo_bypass': True,
        'nocheckcertificate': True,
        'ignoreerrors': True,
        'no_warnings': True,
        'user_agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/91.0.4472.124 Safari/537.36'
        ),
    }

    try:
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_mood = {
                executor.submit(fetch_single_mood, mood, query, ydl_opts, playlist_size): mood
                for mood, query in MOOD_QUERIES.items()
            }

            for future in as_completed(future_to_mood):
                mood, songs = future.result()
                mood_playlists[mood] = songs

        # Ensure all keys exist even if a fetch failed
        for mood in MOOD_QUERIES:
            if mood not in mood_playlists:
                mood_playlists[mood] = []

        return mood_playlists

    except Exception as e:
        print(f"Error fetching mood playlists: {e}")
        return {k: [] for k in MOOD_QUERIES}


def fetch_trending():
    """Fetch trending music.

    BUG FIX: Previously, entries were appended to the list BEFORE the
    'no video ID' guard, meaning blank/invalid entries could be added.
    The guard now runs BEFORE the append.
    """
    try:
        options = {
            'quiet': True,
            'extract_flat': True,
            'no_warnings': True,
        }

        with YoutubeDL(options) as ydl:
            trending_data = ydl.extract_info(
                'ytsearch25:trending music 2025 latest hits',
                download=False
            )

            trending_songs = []
            for entry in trending_data.get('entries', []):
                # Guard first — skip before doing any work on this entry
                if not entry or not entry.get('id'):
                    continue

                full_title = entry.get('title', '')
                artist = entry.get('uploader', '')

                if not artist or artist == 'Unknown Artist':
                    parts = full_title.split('-', 1)
                    if len(parts) > 1:
                        artist = parts[0].strip()
                        title = parts[1].strip()
                    else:
                        artist = entry.get('channel', 'Unknown Artist')
                        title = full_title
                else:
                    title = full_title

                trending_songs.append({
                    'title': title,
                    'url': f"https://www.youtube.com/watch?v={entry['id']}",
                    'artist': artist,
                    'thumbnail': _best_thumbnail(entry.get('thumbnails', [])),
                    'duration': _format_duration(entry.get('duration')),
                })

            return trending_songs

    except Exception as e:
        print(f"Error fetching trending: {e}")
        return [
            {
                'title': 'Popular Music',
                'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'artist': 'Various Artists',
                'thumbnail': 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                'duration': 'Unknown',
            }
        ]
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


def fetch_single_mood(mood, search_query, ydl_opts, playlist_size):
    """Fetch songs for a single mood."""
    try:
        with YoutubeDL(ydl_opts) as ydl:
            full_query = f'ytsearch{playlist_size}:{search_query}'
            info = ydl.extract_info(full_query, download=False)
            playlist_songs = []
            
            for entry in info.get('entries', []):
                if entry:  
                    thumbnails = entry.get('thumbnails', [])
                    thumbnail_url = ''
                    if thumbnails:
                        for thumb in thumbnails:
                            if thumb.get('height', 0) >= 180:
                                thumbnail_url = thumb['url']
                                break
                        if not thumbnail_url and thumbnails:
                            thumbnail_url = thumbnails[0]['url']

                    duration = entry.get('duration')
                    if duration:
                        minutes = int(duration) // 60
                        seconds = int(duration) % 60
                        duration_str = f"{minutes}:{seconds:02d}"
                    else:
                        duration_str = "Unknown"

                    song = {
                        'title': entry.get('title', 'Unknown Title'),
                        'url': f"https://www.youtube.com/watch?v={entry.get('id')}",
                        'thumbnail': thumbnail_url,
                        'channel': entry.get('channel', entry.get('uploader', 'Unknown Artist')),
                        'duration': duration_str
                    }
                    playlist_songs.append(song)
            return mood, playlist_songs
    except Exception as mood_error:
        print(f"Error fetching playlist for mood '{mood}': {mood_error}")
        return mood, []


def fetch_mood_playlists(playlist_size=7):
    """Fetch playlists for all moods."""
    mood_playlists = {}
    
    ydl_opts = {
        'format': 'bestaudio',
        'quiet': True,
        'extract_flat': True,
        'geo_bypass': True,
        'nocheckcertificate': True,
        'ignoreerrors': True,
        'no_warnings': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
                
        # Ensure all keys exist even if failed
        for mood in MOOD_QUERIES:
            if mood not in mood_playlists:
                mood_playlists[mood] = []
                
        return mood_playlists
    
    except Exception as e:
        print(f"Error fetching mood playlists: {e}")
        # Return a basic structure to prevent template errors
        return {k: [] for k in MOOD_QUERIES}


def fetch_trending():
    """Fetch trending music."""
    try:
        options = {
            'quiet': True,
            'extract_flat': True,
            'no_warnings': True,
        }
        
        with YoutubeDL(options) as ydl:
            # Use a more reliable search for trending music
            trending_data = ydl.extract_info(
                'ytsearch25:trending music 2025 latest hits',
                download=False
            )
            
            trending_songs = []
            for entry in trending_data.get('entries', []):
                full_title = entry.get('title', '')
                artist = entry.get('uploader', '')  

                if not artist or artist == "Unknown Artist":
                    parts = full_title.split('-', 1)
                    if len(parts) > 1:
                        artist = parts[0].strip()
                        title = parts[1].strip()
                    else:
                        artist = entry.get('channel', 'Unknown Artist')
                        title = full_title
                else:
                    title = full_title

                thumbnails = entry.get('thumbnails', [])
                thumbnail_url = ''
                if thumbnails:
                    for thumb in thumbnails:
                        if thumb.get('height', 0) >= 180:
                            thumbnail_url = thumb['url']
                            break
                    if not thumbnail_url and thumbnails:
                        thumbnail_url = thumbnails[0]['url']

                duration = entry.get('duration')
                if duration:
                    minutes = int(duration) // 60
                    seconds = int(duration) % 60
                    duration_str = f"{minutes}:{seconds:02d}"
                else:
                    duration_str = "Unknown"

                trending_songs.append({
                    "title": title,
                    "url": f"https://www.youtube.com/watch?v={entry['id']}",
                    "artist": artist,
                    "thumbnail": thumbnail_url,
                    "duration": duration_str
                })
            
            return trending_songs  
    except Exception as e:
        print(f"Error fetching trending: {e}")
        # Return some fallback content if trending fails
        fallback_songs = [
            {
                "title": "Popular Music",
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "artist": "Various Artists",
                "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
            }
        ]
        return fallback_songs

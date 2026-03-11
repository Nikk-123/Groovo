"""
Player and playback module for Groovo application.
Handles song playback, search, and playlist/trending API endpoints.
"""

from flask import jsonify, request
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError
import logging

from modules.youtube import fetch_trending, fetch_single_mood, MOOD_QUERIES


def register_player_routes(flask_app):
    """Register all player/playback related routes."""
    
    @flask_app.route('/play', methods=['POST', 'OPTIONS'])
    def play():
        if request.method == 'OPTIONS':
            response = jsonify({'status': 'ok'})
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            response.headers.add('Access-Control-Allow-Methods', 'POST')
            return response

        data = request.get_json() or {}
        video_url = data.get('url')

        if not video_url:
            return jsonify({"success": False, "error": "No URL provided"}), 400

        base_opts = {
            'quiet': True,
            'noplaylist': True,
            'no_warnings': True,
            'skip_download': True,
            'ignore_no_formats_error': True,
            'force_generic_extractor': False,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://www.youtube.com/'
            },
            'socket_timeout': 20,
            'source_address': '0.0.0.0',
        }

        format_candidates = [
            'bestaudio[protocol^=https]',
            'bestaudio/best',
            'best',
        ]

        info = None
        last_error = None

        try:
            for fmt in format_candidates:
                ydl_opts = dict(base_opts)
                ydl_opts['format'] = fmt
                try:
                    with YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(video_url, download=False)
                    if info:
                        break
                except DownloadError as err:
                    last_error = err
                    continue

            if not info:
                error_message = str(last_error) if last_error else 'Unable to extract video information'
                return jsonify({
                    "success": False,
                    "error": error_message
                }), 500

            if info.get('_type') == 'playlist':
                entries = info.get('entries') or []
                info = next((entry for entry in entries if entry), None)

            if not info:
                return jsonify({
                    "success": False,
                    "error": "Unable to extract video information"
                }), 500

            audio_url = None

            requested_formats = info.get('requested_formats') or []
            if requested_formats:
                audio_candidates = [
                    f for f in requested_formats
                    if f.get('vcodec') in (None, 'none') and f.get('url')
                ]
                if audio_candidates:
                    audio_url = audio_candidates[-1]['url']

            if not audio_url:
                formats = info.get('formats') or []
                audio_formats = [
                    f for f in formats
                    if f.get('acodec') not in (None, 'none') and f.get('vcodec') in (None, 'none') and f.get('url')
                ]

                def sort_key(fmt):
                    return (
                        fmt.get('abr') or fmt.get('tbr') or 0,
                        fmt.get('filesize') or fmt.get('filesize_approx') or 0
                    )

                https_audio = [f for f in audio_formats if str(f.get('protocol', '')).startswith('https')]
                candidate_formats = sorted(https_audio or audio_formats, key=sort_key)
                if candidate_formats:
                    audio_url = candidate_formats[-1]['url']
                else:
                    audio_url = info.get('url') or info.get('direct_url')

            if not audio_url:
                return jsonify({
                    "success": False,
                    "error": "No audio formats available"
                }), 500

            thumbnails = info.get('thumbnails', [])
            thumbnail_url = ''
            if thumbnails:
                sorted_thumbs = sorted(thumbnails, key=lambda x: x.get('height', 0), reverse=True)
                thumbnail_url = sorted_thumbs[0].get('url', '')

            artist = (
                info.get('artist') or
                info.get('uploader') or
                info.get('channel') or
                'Unknown Artist'
            )

            title = info.get('title', 'Unknown Title')
            duration = info.get('duration', 0)

            response = jsonify({
                'success': True,
                'audio_url': audio_url,
                'title': title,
                'thumbnail': thumbnail_url,
                'artist': artist,
                'duration': duration
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response

        except Exception as e:
            logging.exception("yt-dlp playback failure for %s", video_url)
            print(f"[ERROR] /play: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Error fetching audio: {str(e)}"
            }), 500

    @flask_app.route('/search', methods=['GET'])
    def search_song():
        query = request.args.get('query')
        if not query:
            return jsonify([])

        try:
            ydl_opts = {
                'format': 'bestaudio/best',
                'quiet': True,
                'extract_flat': True,
                'no_warnings': True,
                'default_search': 'ytsearch25',
                'source_address': '0.0.0.0',
            }

            with YoutubeDL(ydl_opts) as ydl:
                search_query = f"ytsearch25:{query} music"
                info = ydl.extract_info(search_query, download=False)
                
                results = []
                for entry in info.get('entries', []):
                    if not entry:
                        continue
                        
                    thumbnails = entry.get('thumbnails', [])
                    thumbnail_url = ''
                    if thumbnails:
                        for thumb in thumbnails:
                            if thumb.get('height', 0) >= 180:
                                thumbnail_url = thumb['url']
                                break
                        if not thumbnail_url and thumbnails:
                            thumbnail_url = thumbnails[0]['url']

                    full_title = entry.get('title', '')
                    artist = entry.get('channel', entry.get('uploader', ''))
                    
                    if ' - ' in full_title:
                        parts = full_title.split(' - ', 1)
                        if len(parts) == 2:
                            artist = parts[0].strip()
                            title = parts[1].strip()
                        else:
                            title = full_title
                    else:
                        title = full_title

                    duration = entry.get('duration')
                    if duration:
                        minutes = int(duration) // 60
                        seconds = int(duration) % 60
                        duration_str = f"{minutes}:{seconds:02d}"
                    else:
                        duration_str = "Unknown"

                    result = {
                        'title': title,
                        'url': f"https://www.youtube.com/watch?v={entry.get('id', '')}",
                        'thumbnail': thumbnail_url,
                        'duration': duration_str,
                        'artist': artist,
                        'views': entry.get('view_count', 'N/A'),
                    }
                    if not entry.get('id'):
                        continue  # Skip entries with no video ID
                    results.append(result)

                return jsonify(results)

        except Exception as e:
            print(f"Error searching for song: {e}")
            return jsonify({"error": "Failed to search for song"}), 500

    @flask_app.route('/api/trending')
    def api_trending():
        songs = fetch_trending()
        return jsonify(songs)

    @flask_app.route('/api/playlist')
    def api_playlist():
        mood = request.args.get('mood')
        if not mood:
            return jsonify([])
        
        query = MOOD_QUERIES.get(mood)
        if not query:
            return jsonify([])

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
        
        # Reuse fetch_single_mood
        _, songs = fetch_single_mood(mood, query, ydl_opts, playlist_size=7)
        return jsonify(songs)
"""
Player and playback module for Groovo application.
Handles song playback, search, and playlist/trending API endpoints.
"""

import logging
from flask import jsonify, request
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

from modules.youtube import (
    fetch_trending,
    fetch_single_mood,
    MOOD_QUERIES,
    _build_opts,
    _extract_info,
)


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

        # Try formats from best to most compatible.
        # _extract_info handles cookie-fallback internally; DownloadError is
        # only raised when the format itself is unavailable, not for cookie errors.
        format_candidates = [
            'bestaudio[protocol^=https]',
            'bestaudio/best',
            'best',
        ]

        info       = None
        last_error = None

        try:
            for fmt in format_candidates:
                ydl_opts = _build_opts({
                    'noplaylist': True,
                    'format':     fmt,
                    'skip_download': True,
                })
                try:
                    info = _extract_info(ydl_opts, video_url)
                    if info:
                        break
                except DownloadError as err:
                    last_error = err
                    logging.warning("[/play] DownloadError fmt=%s: %s", fmt, err)
                    continue

            if not info:
                msg = str(last_error) if last_error else 'Unable to extract video information'
                logging.error("[/play] All candidates failed for %s: %s", video_url, msg)
                return jsonify({"success": False, "error": msg}), 500

            # Unwrap single-entry playlists (e.g. YouTube embeds)
            if info.get('_type') == 'playlist':
                entries = info.get('entries') or []
                info = next((e for e in entries if e), None)

            if not info:
                return jsonify({"success": False, "error": "Unable to extract video information"}), 500

            # ── Audio URL resolution ──────────────────────────────────────────
            audio_url = None

            # 1. Prefer requested_formats (present when yt-dlp selects a stream)
            requested_formats = info.get('requested_formats') or []
            if requested_formats:
                audio_candidates = [
                    f for f in requested_formats
                    if f.get('vcodec') in (None, 'none') and f.get('url')
                ]
                if audio_candidates:
                    audio_url = audio_candidates[-1]['url']

            # 2. Fall back to manual format selection
            if not audio_url:
                formats = info.get('formats') or []
                audio_formats = [
                    f for f in formats
                    if f.get('acodec') not in (None, 'none')
                    and f.get('vcodec') in (None, 'none')
                    and f.get('url')
                ]

                def _sort_key(f):
                    return (
                        f.get('abr') or f.get('tbr') or 0,
                        f.get('filesize') or f.get('filesize_approx') or 0,
                    )

                https_audio = [f for f in audio_formats
                               if str(f.get('protocol', '')).startswith('https')]
                candidates = sorted(https_audio or audio_formats, key=_sort_key)

                if candidates:
                    audio_url = candidates[-1]['url']
                else:
                    # Last resort: top-level URL (may be muxed)
                    audio_url = info.get('url') or info.get('direct_url')

            if not audio_url:
                logging.error("[/play] No audio URL found for %s", video_url)
                return jsonify({"success": False, "error": "No audio formats available"}), 500

            # ── Metadata ──────────────────────────────────────────────────────
            thumbnails = info.get('thumbnails') or []
            thumbnail_url = ''
            if thumbnails:
                sorted_thumbs = sorted(
                    thumbnails, key=lambda x: x.get('height', 0), reverse=True
                )
                thumbnail_url = sorted_thumbs[0].get('url', '')

            artist = (
                info.get('artist')
                or info.get('uploader')
                or info.get('channel')
                or 'Unknown Artist'
            )
            title    = info.get('title', 'Unknown Title')
            duration = info.get('duration', 0)

            response = jsonify({
                'success':   True,
                'audio_url': audio_url,
                'title':     title,
                'thumbnail': thumbnail_url,
                'artist':    artist,
                'duration':  duration,
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response

        except Exception as e:
            logging.exception("[/play] Unhandled exception for %s", video_url)
            return jsonify({"success": False, "error": f"Error fetching audio: {str(e)}"}), 500


    @flask_app.route('/search', methods=['GET'])
    def search_song():
        query = request.args.get('query', '').strip()
        if not query:
            return jsonify([])

        try:
            ydl_opts = _build_opts({'skip_download': True})

            info = _extract_info(ydl_opts, f"ytsearch25:{query} music")

            results = []
            for entry in (info or {}).get('entries', []):
                # Guard first — skip entries without a playable video ID
                if not entry or not entry.get('id'):
                    continue

                # Thumbnail: prefer height >= 180
                thumbnail_url = ''
                for thumb in (entry.get('thumbnails') or []):
                    if thumb.get('height', 0) >= 180:
                        thumbnail_url = thumb['url']
                        break
                if not thumbnail_url:
                    thumbs = entry.get('thumbnails') or []
                    thumbnail_url = thumbs[0]['url'] if thumbs else ''

                # Artist / title: split on " - " convention
                full_title = entry.get('title', '')
                artist     = entry.get('channel') or entry.get('uploader') or ''
                if ' - ' in full_title:
                    parts  = full_title.split(' - ', 1)
                    artist = parts[0].strip()
                    title  = parts[1].strip()
                else:
                    title = full_title

                # Duration
                raw_dur      = entry.get('duration')
                duration_str = (
                    f"{int(raw_dur) // 60}:{int(raw_dur) % 60:02d}"
                    if raw_dur else 'Unknown'
                )

                results.append({
                    'title':     title,
                    'url':       f"https://www.youtube.com/watch?v={entry['id']}",
                    'thumbnail': thumbnail_url,
                    'duration':  duration_str,
                    'artist':    artist,
                    'views':     entry.get('view_count', 'N/A'),
                })

            return jsonify(results)

        except Exception as e:
            logging.exception("[/search] Failed for query=%s", query)
            return jsonify({"error": "Failed to search for song"}), 500


    @flask_app.route('/api/trending')
    def api_trending():
        songs = fetch_trending()
        return jsonify(songs)


    @flask_app.route('/api/playlist')
    def api_playlist():
        mood = request.args.get('mood', '').strip()
        if not mood:
            return jsonify([])

        query = MOOD_QUERIES.get(mood)
        if not query:
            return jsonify([])

        ydl_opts = _build_opts({
            'geo_bypass':         True,
            'nocheckcertificate': True,
            'ignoreerrors':       True,
        })

        _, songs = fetch_single_mood(mood, query, ydl_opts, playlist_size=7)
        return jsonify(songs)
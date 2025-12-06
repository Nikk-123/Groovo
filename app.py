import webview
from flask import Flask, redirect, request, session, jsonify, render_template, url_for, flash
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from dotenv import load_dotenv
from flask_cors import CORS
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError
import logging
import requests
import ctypes

# Set App User Model ID (AUMID) for Windows
# This ensures the app has a distinct identity in the taskbar and notifications
try:
    myappid = 'Groovo.App.v1' # arbitrary string
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
except Exception as e:
    logging.error(f"Failed to set AUMID: {e}")

# Load environment variables
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    load_dotenv(os.path.join(bundle_dir, '.env'))
else:
    load_dotenv()

# Add face service URL (set via environment variable)
FACE_SERVICE_URL = os.getenv('FACE_SERVICE_URL', '#')
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://192.168.0.112:9000')

# Flask app setup
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.secret_key = 'REMOVED_SECRET_KEY'
app.permanent_session_lifetime = timedelta(days=30)

# Configure logging
logging.basicConfig(level=logging.INFO)

# In-memory storage for users
users = []

def fetch_single_mood(mood, search_query, ydl_opts, playlist_size):
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

                    song = {
                        'title': entry.get('title', 'Unknown Title'),
                        'url': f"https://www.youtube.com/watch?v={entry.get('id')}",
                        'thumbnail': thumbnail_url,
                        'channel': entry.get('channel', entry.get('uploader', 'Unknown Artist'))
                    }
                    playlist_songs.append(song)
            return mood, playlist_songs
    except Exception as mood_error:
        print(f"Error fetching playlist for mood '{mood}': {mood_error}")
        return mood, []

def fetch_mood_playlists(playlist_size=7):
    moods = {
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
            future_to_mood = {executor.submit(fetch_single_mood, mood, query, ydl_opts, playlist_size): mood for mood, query in moods.items()}
            
            for future in as_completed(future_to_mood):
                mood, songs = future.result()
                mood_playlists[mood] = songs
                
        # Ensure all keys exist even if failed
        for mood in moods:
            if mood not in mood_playlists:
                mood_playlists[mood] = []
                
        return mood_playlists
    
    except Exception as e:
        print(f"Error fetching mood playlists: {e}")
        # Return a basic structure to prevent template errors
        return {k: [] for k in moods}

def fetch_trending():
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

                trending_songs.append({
                    "title": title,
                    "url": f"https://www.youtube.com/watch?v={entry['id']}",
                    "artist": artist,
                    "thumbnail": thumbnail_url
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

# @app.route('/login', methods=['GET', 'POST'])
# def login():
#     if request.method == 'POST':
#         email = request.form.get('email')
#         password = request.form.get('password')
        
#         try:
#             response = requests.post(f'{AUTH_SERVICE_URL}/api/login', 
#                                   json={'email': email, 'password': password})
#             data = response.json()
            
#             if data.get('success'):
#                 session['user_id'] = email
#                 if request.headers.get('Accept') == 'application/json':
#                     return jsonify({
#                         'success': True,
#                         'redirect': url_for('dashboard'),
#                         'library': data.get('library', [])
#                     })
#                 return redirect(url_for('dashboard'))
#             else:
#                 if request.headers.get('Accept') == 'application/json':
#                     return jsonify({
#                         'success': False,
#                         'message': data.get('message', 'Invalid email or password')
#                     })
#                 return render_template('login.html', error=data.get('message', 'Invalid email or password'))
#         except Exception as e:
#             print(f"Error during login: {str(e)}")
#             if request.headers.get('Accept') == 'application/json':
#                 return jsonify({
#                     'success': False,
#                     'message': 'An error occurred during login'
#                 })
#             return render_template('login.html', error="An error occurred during login")
    
#     return render_template('login.html')

#NEW 
@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    error = None  # Initialize error variable

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        try:
            response = requests.post(f'{AUTH_SERVICE_URL}/api/login', 
                                     json={'email': email, 'password': password})
            data = response.json()
            
            if data.get('success'):
                session['user_id'] = email
                session.permanent = True
                if request.headers.get('Accept') == 'application/json':
                    return jsonify({
                        'success': True,
                        'redirect': url_for('dashboard'),
                        'library': data.get('library', [])
                    })
                return redirect(url_for('dashboard'))
            else:
                error = data.get('message', 'Invalid email or password')
        except Exception as e:
            print(f"Error during login: {str(e)}")
            error = "An error occurred during login"
    
    # Single render_template call for GET or failed POST
    return render_template('login.html', error=error)


# @app.route('/signup', methods=['GET', 'POST'])
# def signup():
#     if request.method == 'POST':
#         email = request.form.get('email')
#         password = request.form.get('password')

#         try:
#             response = requests.post(f'{AUTH_SERVICE_URL}/api/signup', 
#                                   json={'email': email, 'password': password})
#             data = response.json()
            
#             if data.get('success'):
#                 return redirect(url_for('login'))
#             else:
#                 return render_template('signup.html', error=data.get('message', 'Signup failed'))
#         except Exception as e:
#             print(f"Error during signup: {str(e)}")
#             return render_template('signup.html', error="An error occurred during signup")
            
#     return render_template('signup.html')

# NEW
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    error = None  # Initialize error variable

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        try:
            response = requests.post(f'{AUTH_SERVICE_URL}/api/signup', 
                                     json={'email': email, 'password': password})
            data = response.json()
            
            if data.get('success'):
                return redirect(url_for('login'))
            else:
                error = data.get('message', 'Signup failed')
        except Exception as e:
            print(f"Error during signup: {str(e)}")
            error = "An error occurred during signup"
    
    # Single render_template call for GET or failed POST
    return render_template('signup.html', error=error)


@app.route('/logout')
def logout():
    try:
        user_email = session.get('user_id')
        if user_email:
            requests.post(f'{AUTH_SERVICE_URL}/api/logout', 
                        headers={'X-User-Email': user_email})
        session.pop('user_id', None)
    except Exception as e:
        print(f"Error during logout: {str(e)}")
    return redirect(url_for('login'))

@app.route('/check-session')
def check_session():
    try:
        user_email = session.get('user_id')
        if user_email:
            response = requests.get(f'{AUTH_SERVICE_URL}/api/check-session',
                                 headers={'X-User-Email': user_email})
            data = response.json()
            if data.get('success'):
                return jsonify({
                    'success': True,
                    'user': data.get('user'),
                    'library': data.get('library', [])
                })
    except Exception as e:
        print(f"Error checking session: {str(e)}")
    return jsonify({'success': False, 'message': 'No active session'}), 401

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user_email = session['user_id']
    try:
        # Get user data from auth service
        response = requests.get(f'{AUTH_SERVICE_URL}/api/check-session',
                             headers={'X-User-Email': user_email})
        data = response.json()
        
        if not data.get('success'):
            session.pop('user_id', None)
            return redirect(url_for('login'))
        
        user_data = data
        trending_songs = fetch_trending()
        mood_playlists = fetch_mood_playlists()
        user_library_urls = [song['url'] for song in user_data.get('library', [])]
        
        return render_template('dashboard.html',
                             user_email=user_email,
                             user_library=user_data.get('library', []),
                             user_library_urls=user_library_urls,
                             trending=trending_songs,
                             mood_playlists=mood_playlists)
    except Exception as e:
        print(f"Error in dashboard: {str(e)}")
        session.pop('user_id', None)
        return redirect(url_for('login'))

@app.route('/settings')
def settings():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('setting.html')

@app.route('/edit_profile', methods=['POST'])
def edit_profile():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    username = request.form.get('username')
    email = request.form.get('email')
    user_email = session['user_id']

    try:
        # Call auth service API to update profile
        response = requests.post(
            f'{AUTH_SERVICE_URL}/api/update-profile',
            json={
                'username': username,
                'email': email,
                'current_email': user_email
            },
            headers={'X-User-Email': user_email}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                session['user_id'] = email  # Update session with new email
                flash('Profile updated successfully', 'success')
            else:
                flash(data.get('message', 'Failed to update profile'), 'error')
        else:
            flash('Failed to update profile', 'error')
            
        return redirect(url_for('settings'))
    except Exception as e:
        logging.error(f"Error updating profile: {str(e)}")
        flash('An error occurred while updating your profile', 'error')
        return redirect(url_for('settings'))

@app.route('/play', methods=['POST', 'OPTIONS'])
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

@app.route('/search', methods=['GET'])
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
                    'url': f"https://www.youtube.com/watch?v={entry['id']}",
                    'thumbnail': thumbnail_url,
                    'duration': duration_str,
                    'artist': artist,
                    'views': entry.get('view_count', 'N/A'),
                }
                results.append(result)

            return jsonify(results)

    except Exception as e:
        print(f"Error searching for song: {e}")
        return jsonify({"error": "Failed to search for song"}), 500

@app.route('/library/add', methods=['POST'])
def add_to_library():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    
    try:
        song_data = request.json
        user_email = session['user_id']
        
        response = requests.post(f'{AUTH_SERVICE_URL}/library/add',
                              json=song_data,
                              headers={'X-User-Email': user_email})
        
        return jsonify(response.json()), response.status_code
            
    except Exception as e:
        print(f"Error adding to library: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'An error occurred while adding to library'
        }), 500

@app.route('/library/remove', methods=['POST'])
def remove_from_library():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    
    try:
        song_data = request.json
        user_email = session['user_id']
        
        response = requests.post(f'{AUTH_SERVICE_URL}/library/remove',
                              json=song_data,
                              headers={'X-User-Email': user_email})
        
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/library/get', methods=['GET'])
def get_library():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    
    try:
        user_email = session['user_id']
        response = requests.get(f'{AUTH_SERVICE_URL}/api/check-session',
                             headers={'X-User-Email': user_email})
        data = response.json()
        
        if data.get('success'):
            return jsonify({
                'success': True,
                'library': data.get('library', [])
            })
        return jsonify({
            'success': False,
            'message': 'Failed to fetch library'
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': 'An internal server error occurred',
        'error': str(error)
    }), 500

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({
        'success': False,
        'message': 'Resource not found'
    }), 404



@app.route('/face_auth')
def face_auth():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user_email = session['user_id']
    try:
        # Get user data from auth service
        response = requests.get(f'{AUTH_SERVICE_URL}/api/check-session',
                             headers={'X-User-Email': user_email})
        data = response.json()
        
        if not data.get('success'):
            session.pop('user_id', None)
            return redirect(url_for('login'))
        
        user_data = data.get('user', {})
        
        # Check face model
        logging.info(f"Checking face model for {user_email} at {FACE_SERVICE_URL}/check_model")
        face_response = requests.post(f'{FACE_SERVICE_URL}/check_model', 
                                   json={'username': user_email}, 
                                   timeout=5)
        face_response.raise_for_status()
        face_data = face_response.json()
        user_data['has_model'] = face_data.get('has_model', False)
        logging.info(f"Face service response: {face_data}")
        
        return render_template('face_auth.html', user_data=user_data)
        
    except Exception as e:
        logging.error(f"Error in face_auth: {str(e)}")
        flash('Unable to connect to services.', 'error')
        return redirect(url_for('login'))

@app.route('/update_face_auth', methods=['POST'])
def update_face_auth():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user_email = session['user_id']
    enable_face_auth = request.form.get('enableFaceAuth') == 'on'
    
    try:
        # Call auth service API to update face auth settings
        response = requests.post(
            f'{AUTH_SERVICE_URL}/api/update-face-auth',
            json={'face_auth_enabled': enable_face_auth},
            headers={'X-User-Email': user_email}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                flash('Face authentication settings updated successfully', 'success')
            else:
                flash(data.get('message', 'Failed to update face authentication settings'), 'error')
        else:
            flash('Failed to update face authentication settings', 'error')
            
        return redirect(url_for('face_auth'))
    except Exception as e:
        logging.error(f"Error updating face authentication: {str(e)}")
        flash('An error occurred while updating face authentication settings', 'error')
        return redirect(url_for('face_auth'))

@app.route('/delete_model', methods=['POST'])
def delete_model():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user_email = session['user_id']
    try:
        response = requests.post(f'{FACE_SERVICE_URL}/delete_model', json={'username': user_email})
        result = response.json()
        flash(result['message'], result['status'])
        return redirect(url_for('face_auth'))
    except Exception as e:
        logging.error(f"Error deleting face model for {user_email}: {str(e)}")
        flash('Error contacting face service.', 'error')
        return redirect(url_for('face_auth'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        if username:
            users.append(username)
            return jsonify({'status': 'success', 'message': 'Registration started'})
    return render_template('register.html')

@app.route('/upload_frames', methods=['POST'])
def upload_frames():
    data = request.get_json()
    try:
        response = requests.post(f'{FACE_SERVICE_URL}/upload_frames', json=data)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        logging.error(f"Error uploading frames: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error contacting face service'}), 500

@app.route('/match_face', methods=['POST'])
def match_face():
    data = request.get_json()
    try:
        response = requests.post(f'{FACE_SERVICE_URL}/match_face', json=data)
        result = response.json()
        if result.get('status') == 'success' and result.get('verified'):
            session['user_id'] = result['username']
            session.permanent = True
            return jsonify({
                'status': 'success',
                'verified': True,
                'username': result['username'],
                'redirect': url_for('dashboard')  # Redirect to dashboard
            }), response.status_code
        return jsonify(result), response.status_code
    except Exception as e:
        logging.error(f"Error matching face: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error contacting face service'}), 500
    

@app.route('/shutdown', methods=['GET'])
def shutdown():
    try:
        # Get the shutdown function from the environment
        shutdown_func = request.environ.get('werkzeug.server.shutdown')
        if shutdown_func is None:
            # If we're not running with Werkzeug server, use a different approach
            import os
            import signal
            os.kill(os.getpid(), signal.SIGTERM)
            return 'Server shutting down...'
        shutdown_func()
        return 'Server shutting down...'
    except Exception as e:
        print(f"Error during shutdown: {str(e)}")
        return 'Error during shutdown', 500

if __name__ == "__main__":
    # Start Flask in a separate thread
    from threading import Thread
    flask_thread = Thread(target=lambda: app.run(debug=True, use_reloader=False, port=8000))
    flask_thread.daemon = True
    flask_thread.start()
    
    # Create and start webview window
    import os
    if getattr(sys, 'frozen', False):
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
    icon_path = os.path.join(base_dir, 'static', 'icon.png')
    
    # Note: 'icon' parameter removed as it causes TypeError in current environment
    window = webview.create_window("Groovo", "http://127.0.0.1:8000/")
    
    def cleanup():
        try:
            # Stop Flask server
            import requests
            try:
                requests.get('http://127.0.0.1:8000/shutdown', timeout=1)
            except:
                pass  # Ignore any connection errors during shutdown
            
            # Clear any in-memory data
            users.clear()
            
            # Force exit the application
            import sys
            sys.exit(0)
            
        except Exception as e:
            print(f"Error during cleanup: {str(e)}")
            # Force exit even if there's an error
            import sys
            sys.exit(1)
    
    # Register cleanup function
    window.events.closed += cleanup
    
    # Start webview
    webview.start(private_mode=False)
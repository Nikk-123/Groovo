from flask import Flask, request, session, jsonify, make_response
from pymongo import MongoClient
import os
import sys
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin
from yt_dlp import YoutubeDL
from functools import wraps
from flask_session import Session
from flask import Response
import requests
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Define allowed origins
allowed_origins = [
    "https://spotify-3-0-es19.onrender.com",
    "https://spotify30.netlify.app"
]

# Flask app setup
app = Flask(__name__)

# CORS configuration
CORS(app, 
     resources={r"/*": {
         "origins": allowed_origins,
         "supports_credentials": True,
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type", "Authorization"],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
     }})

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Expose-Headers'] = 'Set-Cookie'
        response.headers['Vary'] = 'Origin'
    return response

app.secret_key = 'Chayan@12'

# Session configuration
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'  # Allow cross-site cookies
app.config['SESSION_COOKIE_DOMAIN'] = None  # Allow cookies for all domains
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_NAME'] = 'spotify_session'
app.config['SESSION_REFRESH_EACH_REQUEST'] = True
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_KEY_PREFIX'] = 'spotify:'
app.config['SESSION_FILE_DIR'] = './flask_session'
app.config['SESSION_FILE_THRESHOLD'] = 100
app.config['SESSION_FILE_MODE'] = 384  # 0600 in octal

# Initialize session
Session(app)

# MongoDB Atlas setup
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    print("Error: MONGO_URI not found in environment variables")
    sys.exit(1)
client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=20000,
    connect=True
)
db = client.get_database('music_app')
users_collection = db.users

# User class
class User:
    def __init__(self, user_id, email, password, library):
        self.user_id = user_id
        self.email = email
        self.password = password
        self.library = library

    def check_password(self, password):
        return self.password == password

def get_user_by_email(email):
    return users_collection.find_one({'email': email})

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
        with YoutubeDL(ydl_opts) as ydl:
            for mood, search_query in moods.items():
                try:
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
                    
                    mood_playlists[mood] = playlist_songs
                except Exception as mood_error:
                    print(f"Error fetching playlist for mood '{mood}': {mood_error}")
                    mood_playlists[mood] = []  
                
        return mood_playlists
    
    except Exception as e:
        print(f"Error fetching mood playlists: {e}")
        return {}

def fetch_trending():
    try:
        options = {
            'quiet': True,
            'extract_flat': True,
            'playlist_items': '1-28',  
            'no_warnings': True,
        }
        
        with YoutubeDL(options) as ydl:
            trending_data = ydl.extract_info(
                'https://www.youtube.com/feed/trending?bp=4gINGgt5dG1hX2NoYXJ0cw%3D%3D MILLIND GABA',
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
        return []

# Login API
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400
    user_data = get_user_by_email(email)
    if user_data and User(user_data['_id'], user_data['email'], user_data['password'], user_data['library']).check_password(password):
        session['user_id'] = email
        session.permanent = True
        response = jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {'email': email, 'library': user_data.get('library', [])}
        })
        return response
    return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

# Signup API
@app.route('/api/signup', methods=['POST'])
def api_signup():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400

        existing_user = get_user_by_email(email)
        if existing_user:
            return jsonify({'success': False, 'message': 'User already exists'}), 409
        
        new_user = {'email': email, 'password': password, 'library': []}
        users_collection.insert_one(new_user)
        return jsonify({'success': True, 'message': 'User created successfully'})
    except Exception as e:
        print(f"Error during signup: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred during signup'}), 500

# Logout API
@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.pop('user_id', None)
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    })

# Root API (status check)
@app.route('/api', methods=['GET'])
def api_index():
    return jsonify({'success': True, 'message': 'API is running'})

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        user_email = session['user_id']
        user_data = get_user_by_email(user_email)
        if not user_data:
            session.pop('user_id', None)
            return jsonify({'success': False, 'message': 'User not found'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Dashboard API
@app.route('/api/dashboard', methods=['GET'])
@login_required
def api_dashboard():
    try:
        user_id = session['user_id']
        user = get_user_by_email(user_id)
        trending = fetch_trending()
        mood_playlists = fetch_mood_playlists()
        return jsonify({
            'success': True,
            'user_email': user['email'],
            'trending': trending,
            'mood_playlists': mood_playlists
        })
    except Exception as e:
        print(f"Error in /api/dashboard: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

@app.route('/api/play', methods=['POST', 'OPTIONS'])
@cross_origin(origins=allowed_origins, supports_credentials=True)
def play():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Vary', 'Origin')
        return response

    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'Missing URL parameter'}), 400

        url = data['url']
        logger.debug(f"Processing URL: {url}")
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'noplaylist': True,
            'no_warnings': True,
            'geturl': True,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.youtube.com/',
                'Origin': 'https://www.youtube.com',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            },
            'socket_timeout': 30,
            'nocheckcertificate': True,
            'ignoreerrors': True,
            'geo_bypass': True,
            'logger': logger,
            'extractor_retries': 3,
            'retries': 3,
            'fragment_retries': 3,
            'skip_unavailable_fragments': True,
            'extract_flat': True,
            'no_color': True,
            'no_check_certificate': True,
            'no_warnings': True,
            'quiet': True,
            'ignoreerrors': True,
            'geo_bypass': True,
            'geo_bypass_country': 'US',
            'geo_bypass_ip_block': None,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.youtube.com/',
                'Origin': 'https://www.youtube.com',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            }
        }

        with YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                if not info:
                    logger.error("yt_dlp returned no info")
                    return jsonify({"success": False, "error": "Unable to extract video information"}), 500

                audio_url = info.get('url')
                if not audio_url:
                    logger.error("No audio URL found in info")
                    return jsonify({"success": False, "error": "No audio URL found"}), 500

                # Proxy the audio stream
                def stream_audio():
                    try:
                        with requests.get(audio_url, stream=True, headers=ydl_opts['http_headers']) as r:
                            r.raise_for_status()
                            for chunk in r.iter_content(chunk_size=8192):
                                if chunk:
                                    yield chunk
                    except Exception as e:
                        logger.error(f"Error streaming audio: {str(e)}")
                        yield b''

                response = Response(stream_audio(), mimetype='audio/mpeg')
                response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Content-Disposition'] = 'inline'
                return response

            except Exception as e:
                logger.error(f"Error in yt_dlp: {str(e)}")
                return jsonify({"success": False, "error": f"Error processing video: {str(e)}"}), 500

    except Exception as e:
        logger.error(f"Exception in /api/play: {str(e)}")
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

# Search API (unchanged, already JSON-based)
@app.route('/api/search', methods=['GET'])
def api_search():
    query = request.args.get('query')
    if not query:
        return jsonify([])

    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'extract_flat': True,
        'no_warnings': True,
        'default_search': 'ytsearch10',
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            search_query = f"ytsearch10:{query} music"
            info = ydl.extract_info(search_query, download=False)
            results = []
            for entry in info.get('entries', []):
                if not entry:
                    continue
                thumbnails = entry.get('thumbnails', [])
                thumbnail_url = thumbnails and [t['url'] for t in thumbnails if t.get('height', 0) >= 180][0] if any(t.get('height', 0) >= 180 for t in thumbnails) else thumbnails[0]['url'] if thumbnails else ''

                full_title = entry.get('title', '')
                artist = entry.get('channel', entry.get('uploader', ''))
                title = full_title.split(' - ', 1)[1].strip() if ' - ' in full_title and len(full_title.split(' - ', 1)) > 1 else full_title
                if ' - ' in full_title:
                    artist = full_title.split(' - ', 1)[0].strip()

                duration = entry.get('duration')
                duration_str = f"{int(duration) // 60}:{int(duration) % 60:02d}" if duration else "Unknown"

                results.append({
                    'title': title,
                    'url': f"https://www.youtube.com/watch?v={entry['id']}",
                    'thumbnail': thumbnail_url,
                    'duration': duration_str,
                    'artist': artist,
                    'views': entry.get('view_count', 'N/A'),
                })
            return jsonify(results)
    except Exception as e:
        print(f"Error searching for song: {e}")
        return jsonify({"success": False, "error": "Failed to search for song"}), 500

# Library Add API (unchanged, already JSON-based)
@app.route('/api/library/add', methods=['POST'])
@login_required
def api_add_to_library():
    song_data = request.get_json()
    user_email = session['user_id']
    if not song_data or not isinstance(song_data, dict):
        return jsonify({'success': False, 'message': 'Invalid song data'}), 400

    result = users_collection.update_one(
        {'email': user_email},
        {'$addToSet': {'library': song_data}}
    )
    return jsonify({
        'success': result.modified_count > 0,
        'message': 'Song added to library' if result.modified_count > 0 else 'Song already in library or user not found'
    })

# Library Remove API (unchanged, already JSON-based)
@app.route('/api/library/remove', methods=['POST'])
@login_required
def api_remove_from_library():
    song_data = request.get_json()
    user_email = session['user_id']
    result = users_collection.update_one(
        {'email': user_email},
        {'$pull': {'library': {'url': song_data['url']}}}
    )
    return jsonify({
        'success': True,
        'message': 'Song removed from library'
    })

# Library Get API (unchanged, already JSON-based)
@app.route('/api/library', methods=['GET'])
@login_required
def api_get_library():
    user_email = session['user_id']
    user_data = get_user_by_email(user_email)
    return jsonify({
        'success': True,
        'library': user_data.get('library', [])
    })

# Error handlers
@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'An internal server error occurred', 'error': str(error)}), 500

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'success': False, 'message': 'Resource not found'}), 404

# Manifest API (unchanged, already JSON-based)
@app.route('/api/manifest', methods=['GET'])
def api_manifest():
    return jsonify({
        "name": "Spotify 2.0",
        "short_name": "Spotify",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#000000",
        "icons": [{"src": "/static/favicon.png", "sizes": "192x192", "type": "image/png"}]
    })

def test_db_connection():
    try:
        print("Testing MongoDB connection...")
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        return True
    except Exception as e:
        print(f"Failed to connect to MongoDB: {str(e)}")
        return False

if __name__ == "__main__":
    if test_db_connection():
        app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
    else:
        print("Application cannot start due to database connection failure")
        sys.exit(1)

# The following lines were removed because they are JavaScript code and not valid in a Python file.
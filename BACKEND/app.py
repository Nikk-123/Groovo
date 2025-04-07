from flask import Flask, request, session, jsonify
from pymongo import MongoClient
import os
import sys
from dotenv import load_dotenv
from flask_cors import CORS
from yt_dlp import YoutubeDL
from functools import wraps
from flask_session import Session

# Load environment variables
load_dotenv()

# Flask app setup
app = Flask(__name__)

# CORS configuration
CORS(app, 
     resources={r"/*": {
         "origins": [
             "https://spotify-3-0-es19.onrender.com",
             "https://spotify30.netlify.app"
         ],
         "supports_credentials": True,
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type", "Authorization"],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
     }})

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    allowed_origins = [ 
        "https://spotify-3-0-es19.onrender.com",
        "https://spotify30.netlify.app"
    ]
    
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

app.secret_key = 'Chayan@12'

# Session configuration
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400
app.config['SESSION_COOKIE_SECURE'] = True  # Set to True for production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'  # Set to None for cross-site requests
app.config['SESSION_COOKIE_DOMAIN'] = None  # Allow cookies for all domains
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
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {'email': email, 'library': user_data.get('library', [])}
        })
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

# Play API
@app.route('/api/play', methods=['POST', 'OPTIONS'])
def api_play():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        origin = request.headers.get('Origin')
        if origin in [
            "http://localhost:5173", 
            "http://127.0.0.1:5173", 
            "https://spotify-3-0-es19.onrender.com",
            "https://spotify30.netlify.app"
        ]:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400

        video_url = data.get('url')
        if not video_url:
            return jsonify({"success": False, "error": "No URL provided"}), 400

        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'noplaylist': True,
            'no_warnings': True,
            'extractaudio': True,
            'audioformat': 'mp3',
            'outtmpl': '%(id)s.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://www.youtube.com/'
            },
            'socket_timeout': 30,
            'source_address': '0.0.0.0',
            'nocheckcertificate': True,
            'ignoreerrors': True,
            'logtostderr': False,
            'no_warnings': True,
            'default_search': 'auto',
            'extract_flat': False,
        }

        with YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(video_url, download=False)
                if not info:
                    return jsonify({"success": False, "error": "Unable to extract video information"}), 500

                # Get the best audio format
                formats = info.get('formats', [])
                audio_formats = [f for f in formats if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
                
                if not audio_formats:
                    # If no audio-only format, try to get any format with audio
                    audio_formats = [f for f in formats if f.get('acodec') != 'none']
                
                if not audio_formats:
                    return jsonify({"success": False, "error": "No audio formats available"}), 500

                # Get the best quality audio format
                best_format = max(audio_formats, key=lambda x: x.get('abr', 0))
                audio_url = best_format.get('url')
                
                if not audio_url:
                    return jsonify({"success": False, "error": "Could not get audio URL"}), 500

                thumbnails = info.get('thumbnails', [])
                thumbnail_url = thumbnails and sorted(thumbnails, key=lambda x: x.get('height', 0), reverse=True)[0].get('url', '') or ''

                artist = info.get('artist') or info.get('uploader') or info.get('channel') or 'Unknown Artist'
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
                origin = request.headers.get('Origin')
                if origin in [
                    "http://localhost:5173", 
                    "http://127.0.0.1:5173", 
                    "https://spotify-3-0-es19.onrender.com",
                    "https://spotify30.netlify.app"
                ]:
                    response.headers['Access-Control-Allow-Origin'] = origin
                    response.headers['Access-Control-Allow-Credentials'] = 'true'
                return response
            except Exception as e:
                print(f"[ERROR] yt-dlp error: {str(e)}")
                return jsonify({"success": False, "error": f"Error processing video: {str(e)}"}), 500

    except Exception as e:
        print(f"[ERROR] /api/play: {str(e)}")
        response = jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500
        origin = request.headers.get('Origin')
        if origin in [
            "http://localhost:5173", 
            "http://127.0.0.1:5173", 
            "https://spotify-3-0-es19.onrender.com",
            "https://spotify30.netlify.app"
        ]:
            response[0].headers['Access-Control-Allow-Origin'] = origin
            response[0].headers['Access-Control-Allow-Credentials'] = 'true'
        return response

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
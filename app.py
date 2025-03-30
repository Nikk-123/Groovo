import webview
from flask import Flask, redirect, request, session, jsonify, render_template, url_for
from pymongo import MongoClient
import requests
import subprocess
import psutil
import time
import threading
import os
import sys
from dotenv import load_dotenv
from flask_cors import CORS
from yt_dlp import YoutubeDL

# Load environment variables
load_dotenv()

# GitHub Credentials (For Private Repo)
GITHUB_PAT = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = "Nikk-123/Spotify-3.0"
GITHUB_API_RELEASES = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

# Executable File Names
EXE_FILE = "app.exe"
NEW_EXE_FILE = "app_new.exe"
BACKUP_EXE_FILE = "app_backup.exe"

# Headers for authentication (PAT Token)
HEADERS = {"Authorization": f"token {GITHUB_PAT}"}

# Fetch latest release asset URL (For Private Repo)
def get_latest_exe_url():
    if not GITHUB_PAT:
        print("GitHub PAT is not set. Please set the GITHUB_TOKEN environment variable.")
        return None

    try:
        response = requests.get(GITHUB_API_RELEASES, headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            assets = data.get("assets", [])
            for asset in assets:
                if asset["name"] == "app.exe":  # Ensure correct file
                    return asset["url"]  # Use API URL, not browser URL
        else:
            print("GitHub API Error:", response.json())
    except Exception as e:
        print("Error fetching latest EXE URL:", e)
    return None

# Download latest executable (For Private Repo)
def download_latest_exe():
    latest_exe_url = get_latest_exe_url()
    if not latest_exe_url:
        print("No valid update URL found.")
        return False

    try:
        # GitHub requires custom headers to download assets
        asset_headers = {
            "Authorization": f"token {GITHUB_PAT}",
            "Accept": "application/octet-stream"
        }
        response = requests.get(latest_exe_url, headers=asset_headers, stream=True)
        if response.status_code == 200:
            with open(NEW_EXE_FILE, "wb") as file:
                for chunk in response.iter_content(1024):
                    file.write(chunk)
            print("Update downloaded successfully.")
            return True
        else:
            print("Error downloading file:", response.json())
    except Exception as e:
        print(f"Error downloading update: {e}")
    return False

# Check if EXE is running
def is_exe_running():
    for proc in psutil.process_iter(attrs=['pid', 'name']):
        if proc.info['name'].lower() == EXE_FILE.lower():
            return True
    return False

# Apply the update by replacing the EXE file
def apply_update():
    try:
        if os.path.exists(NEW_EXE_FILE):
            if os.path.exists(EXE_FILE):
                os.rename(EXE_FILE, BACKUP_EXE_FILE)
            os.rename(NEW_EXE_FILE, EXE_FILE)

            # Start the new application
            process = subprocess.Popen([EXE_FILE], close_fds=True)
            time.sleep(2)  # Give time for the new process to start

            # Terminate old instances
            current_pid = os.getpid()
            for proc in psutil.process_iter(attrs=['pid', 'name']):
                if proc.info['name'].lower() == EXE_FILE.lower() and proc.info['pid'] != process.pid:
                    try:
                        psutil.Process(proc.info['pid']).terminate()
                    except psutil.NoSuchProcess:
                        pass  # Process already closed

            sys.exit(0)  # Exit current process

    except Exception as e:
        print(f"Error while applying update: {e}")

# Webview API for Update Prompt
class UpdateAPI:
    def apply_update(self):
        apply_update()

# Show update alert using Webview
def show_update_alert():
    html_content = """
    <html>
    <body>
        <h2>New Update Available</h2>
        <p>The application needs to update.</p>
        <button onclick="window.pywebview.api.apply_update()">Update Now</button>
    </body>
    </html>
    """
    webview.create_window("Update Available", html=html_content, js_api=UpdateAPI())
    webview.start()

# Check for updates periodically (every 10 minutes)
def check_for_updates_periodically():
    while True:
        print("Checking for updates...")
        if download_latest_exe():
            show_update_alert()
        time.sleep(600)  # Wait for 10 minutes before checking again

# Start update checker in a separate thread
def start_update_thread():
    update_thread = threading.Thread(target=check_for_updates_periodically, daemon=True)
    update_thread.start()

# Flask app setup
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.secret_key = 'Chayan@12'  # Use secure key from .env



# MongoDB Atlas setup
MONGO_URI = 'mongodb+srv://CHAYAN:CHAYAN%4012@musicapp.ql3my.mongodb.net/?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true'
client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=20000,
    connect=True
)
db = client.get_database('music_app')
users_collection = db.users

# Start update thread
start_update_thread()

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
                'https://www.youtube.com/feed/trending?bp=4gINGgt5dG1hX2NoYXJ0cw%3D%3D',
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

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        print(f"Login attempt for email: {email}")  

        user_data = get_user_by_email(email)
        
        if user_data:
            print("User found in database")  
            try:
                user = User(user_data['_id'], user_data['email'], user_data['password'], user_data['library'])
                if user.check_password(password):
                    print("Password verified successfully")  
                    session['user_id'] = email
                    
                    if request.headers.get('Accept') == 'application/json':
                        return jsonify({
                            'success': True,
                            'redirect': url_for('dashboard'),
                            'library': user_data.get('library', [])
                        })
                    return redirect(url_for('dashboard'))
                else:
                    print("Password verification failed")  
                    if request.headers.get('Accept') == 'application/json':
                        return jsonify({
                            'success': False,
                            'message': 'Invalid email or password'
                        })
                    return render_template('login.html', error="Invalid email or password")
            except Exception as e:
                print(f"Error during login: {str(e)}")  
                if request.headers.get('Accept') == 'application/json':
                    return jsonify({
                        'success': False,
                        'message': 'An error occurred during login'
                    })
                return render_template('login.html', error="An error occurred during login")
        else:
            print("User not found in database")  
            if request.headers.get('Accept') == 'application/json':
                return jsonify({
                    'success': False,
                    'message': 'Invalid email or password'
                })
            return render_template('login.html', error="Invalid email or password")
    
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        existing_user = get_user_by_email(email)
        if existing_user:
            return 'User already exists'
        
        try:
            new_user = {
                'email': email,
                'password': password,  
                'library': []
            }
            
            users_collection.insert_one(new_user)
            return redirect(url_for('login'))
        except Exception as e:
            print(f"Error during signup: {str(e)}")  
            return 'An error occurred during signup'
            
    return render_template('signup.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)  
    return redirect(url_for('login'))

@app.route('/')
def index():
    return redirect(url_for('login'))

def get_latest_version():
    try:
        response = requests.get(GITHUB_API_RELEASES, headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            return data.get("tag_name", "Unknown Version")
        else:
            print("GitHub API Error:", response.json())
    except Exception as e:
        print("Error fetching latest version:", e)
    return "Unknown Version"

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user_email = session['user_id']
    user_data = get_user_by_email(user_email)
    
    if not user_data:
        session.pop('user_id', None)
        return redirect(url_for('login'))
    
    trending_songs = fetch_trending()
    mood_playlists = fetch_mood_playlists()
    latest_version = get_latest_version()
    
    return render_template('dashboard.html', 
                         user_email=user_email,
                         user_library=user_data.get('library', []),
                         trending=trending_songs,
                         mood_playlists=mood_playlists,
                         latest_version=latest_version)

@app.route('/play', methods=['POST', 'OPTIONS'])
def play():
    if request.method == 'OPTIONS':
        # Handle CORS preflight
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    data = request.get_json()
    video_url = data.get('url')

    if not video_url:
        return jsonify({"success": False, "error": "No URL provided"}), 400

    # Updated yt-dlp options for 2025 compatibility
    ydl_opts = {
        'format': 'bestaudio/best',  # Prioritize best audio quality
        'quiet': True,
        'noplaylist': True,          # Ensure single video processing
        'no_warnings': True,
        'extractaudio': True,
        'geturl': True,              # Explicitly get the direct URL
        'simulate': True,            # Don't download, just extract info
        'force_generic_extractor': False,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://www.youtube.com/'
        },
        'socket_timeout': 20,
        'source_address': '0.0.0.0',
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            # Extract info with updated error handling
            info = ydl.extract_info(video_url, download=False)
            
            if not info:
                return jsonify({
                    "success": False,
                    "error": "Unable to extract video information"
                }), 500

            # Handle cases where direct URL might be in different fields
            audio_url = info.get('url') or info.get('direct_url')
            if not audio_url:
                # Fallback to formats if direct URL isn't available
                formats = info.get('formats', [])
                audio_formats = [f for f in formats if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
                if audio_formats:
                    audio_url = audio_formats[-1].get('url')  # Get highest quality audio
                else:
                    return jsonify({
                        "success": False,
                        "error": "No audio formats available"
                    }), 500

            # Extract thumbnail with fallback
            thumbnails = info.get('thumbnails', [])
            thumbnail_url = ''
            if thumbnails:
                # Sort by resolution and get highest available
                sorted_thumbs = sorted(thumbnails, key=lambda x: x.get('height', 0), reverse=True)
                thumbnail_url = sorted_thumbs[0].get('url', '')

            # Get artist information with multiple fallbacks
            artist = (info.get('artist') or 
                     info.get('uploader') or 
                     info.get('channel') or 
                     'Unknown Artist')

            # Extract title and duration
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
            'default_search': 'ytsearch10',  
        }

        with YoutubeDL(ydl_opts) as ydl:
            search_query = f"ytsearch10:{query} music"
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
        
        if not song_data or not isinstance(song_data, dict):
            return jsonify({
                'success': False,
                'message': 'Invalid song data'
            }), 400

        result = users_collection.update_one(
            {'email': user_email},
            {'$addToSet': {'library': song_data}}  
        )
        
        if result.modified_count > 0:
            return jsonify({
                'success': True,
                'message': 'Song added to library'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Song already in library or user not found'
            })
            
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
        
        result = users_collection.update_one(
            {'email': user_email},
            {'$pull': {'library': {'url': song_data['url']}}}
        )
        
        return jsonify({
            'success': True,
            'message': 'Song removed from library'
        })
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
        user_data = get_user_by_email(user_email)
        
        return jsonify({
            'success': True,
            'library': user_data.get('library', [])
        })
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

@app.route('/static/manifest.json')
def manifest():
    return jsonify({
        "name": "Spotify 2.0",
        "short_name": "Spotify",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#000000",
        "icons": [
            {
                "src": "/static/favicon.png",
                "sizes": "192x192",
                "type": "image/png"
            }
        ]
    })

@app.route('/api/version', methods=['GET'])
def get_version():
    if not GITHUB_PAT:
        return jsonify({'version': "Unknown Version", 'error': "GitHub PAT is not set"}), 401

    try:
        response = requests.get(GITHUB_API_RELEASES, headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            return jsonify({'version': data.get("tag_name", "Unknown Version")})
        else:
            return jsonify({'version': "Unknown Version"}), response.status_code
    except Exception as e:
        return jsonify({'version': "Unknown Version", 'error': str(e)}), 500

def test_db_connection():
    try:
        print("Testing MongoDB connection...")
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        return True
    except Exception as e:
        print(f"Failed to connect to MongoDB: {str(e)}")
        print("Please check your connection string and make sure MongoDB Atlas is accessible.")
        return False

if __name__ == "__main__":
    start_update_thread()  # Start update check in the background
    
    # Function to start Flask in a separate thread
    def start_flask():
        try:
            app.run(debug=True, use_reloader=False)  # Ensure reloader is off for threading
        except Exception as e:
            print(f"Error starting Flask: {e}")

    # Run Flask in a separate thread
    flask_thread = threading.Thread(target=start_flask)
    flask_thread.daemon = True
    flask_thread.start()
    
    # Start the GUI with Flask's local server
    try:
        webview.create_window("Spotify-3.0", "http://127.0.0.1:5000/")
        webview.start()
    except Exception as e:
        print(f"Error starting webview: {e}")

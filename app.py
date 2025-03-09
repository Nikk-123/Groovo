import webview
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from pymongo import MongoClient
from yt_dlp import YoutubeDL
from flask_cors import CORS
import threading
import sys
import os
import requests
import subprocess
import psutil
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# GitHub Credentials
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = "Nikk-123/Spotify-3.0"
LATEST_EXE_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

# Executable File Names
EXE_FILE = "app.exe"
NEW_EXE_FILE = "app_new.exe"
BACKUP_EXE_FILE = "app_backup.exe"

# Headers for authentication
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}"}

# Fetch the latest release asset URL
def get_latest_exe_url():
    try:
        response = requests.get(LATEST_EXE_URL, headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            assets = data.get("assets", [])
            for asset in assets:
                if asset["name"] == "app.exe":
                    return asset["browser_download_url"]
    except Exception as e:
        print("Error fetching latest EXE URL:", e)
    return None

# Download the latest executable
def download_latest_exe():
    latest_exe_url = get_latest_exe_url()
    if not latest_exe_url:
        print("No valid update URL found.")
        return False

    try:
        response = requests.get(latest_exe_url, headers=HEADERS, stream=True)
        if response.status_code == 200:
            with open(NEW_EXE_FILE, "wb") as file:
                for chunk in response.iter_content(1024):
                    file.write(chunk)
            return True
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
app.secret_key = 'REMOVED_SECRET_KEY'  # Use secure key from .env



# MongoDB Atlas setup
MONGO_URI = 'REMOVED_MONGO_URI'
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
    
    return render_template('dashboard.html', 
                         user_email=user_email,
                         user_library=user_data.get('library', []),
                         trending=trending_songs,
                         mood_playlists=mood_playlists)

@app.route('/play', methods=['POST', 'OPTIONS'])
def play():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    try:
        data = request.get_json()
        video_url = data.get('url')
        
        if not video_url:
            return jsonify({"success": False, "error": "No URL provided"}), 400

        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extract_audio': True,
            'no_check_certificate': True,
            'prefer_insecure': True,
            'geo_bypass': True,
            'nocheckcertificate': True,
            'extract_flat': False,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
            }]
        }

        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                
                if 'url' in info:
                    audio_url = info['url']
                else:
                    formats = info.get('formats', [])
                    audio_format = None
                    
                    for f in formats:
                        if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                            audio_format = f
                            break
                    
                    if not audio_format:
                        for f in formats:
                            if f.get('acodec') != 'none':
                                audio_format = f
                                break
                    
                    if not audio_format:
                        raise Exception("No suitable audio format found")
                    
                    audio_url = audio_format['url']

                thumbnails = info.get('thumbnails', [])
                thumbnail_url = ''
                if thumbnails:
                    for thumb in thumbnails:
                        if thumb.get('height', 0) >= 180:
                            thumbnail_url = thumb['url']
                            break
                    if not thumbnail_url and thumbnails:
                        thumbnail_url = thumbnails[0]['url']

                artist = info.get('artist', info.get('channel', info.get('uploader', 'Unknown Artist')))

                response = jsonify({
                    'success': True,
                    'audio_url': audio_url,
                    'title': info.get('title', 'Unknown Title'),
                    'thumbnail': thumbnail_url,
                    'artist': artist
                })
                
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response

        except Exception as e:
            print(f"YoutubeDL error: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Could not fetch audio stream: {str(e)}"
            }), 400

    except Exception as e:
        print(f"Error in play route: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
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

import webview
from flask import Flask, redirect, request, session, jsonify, render_template, url_for
from pymongo import MongoClient
import os
import sys
from dotenv import load_dotenv
from flask_cors import CORS
from yt_dlp import YoutubeDL
import base64
import cv2
import numpy as np
from deepface import DeepFace
import pickle
import logging
from scipy.spatial.distance import cosine
import base64

# Load environment variables
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    load_dotenv(os.path.join(bundle_dir, '.env'))
else:
    load_dotenv()

# Flask app setup
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.secret_key = 'REMOVED_SECRET_KEY'

# Configure logging
logging.basicConfig(level=logging.INFO)

# Directories
UPLOAD_FOLDER = 'uploads'
MODEL_FOLDER = 'models'
for folder in [UPLOAD_FOLDER, MODEL_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MODEL_FOLDER'] = MODEL_FOLDER

# In-memory storage for users
users = []

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
        
        user_data = get_user_by_email(email)
        
        if user_data:
            try:
                user = User(user_data['_id'], user_data['email'], user_data['password'], user_data['library'])
                if user.check_password(password):
                    session['user_id'] = email
                    if request.headers.get('Accept') == 'application/json':
                        return jsonify({
                            'success': True,
                            'redirect': url_for('dashboard'),
                            'library': user_data.get('library', [])
                        })
                    return redirect(url_for('dashboard'))
                else:
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
    user_library_urls = [song['url'] for song in user_data.get('library', [])]
    
    return render_template('dashboard.html',
                         user_email=user_email,
                         user_library=user_data.get('library', []),
                         user_library_urls=user_library_urls,
                         trending=trending_songs,
                         mood_playlists=mood_playlists)

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
        users_collection.update_one(
            {'email': user_email},
            {'$set': {'username': username, 'email': email}}
        )
        session['user_id'] = email  # Update session with new email
        return redirect(url_for('settings'))
    except Exception as e:
        print(f"Error updating profile: {e}")
        return "An error occurred while updating your profile. Please try again later."

@app.route('/play', methods=['POST', 'OPTIONS'])
def play():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    data = request.get_json()
    video_url = data.get('url')

    if not video_url:
        return jsonify({"success": False, "error": "No URL provided"}), 400

    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'noplaylist': True,
        'no_warnings': True,
        'extractaudio': True,
        'geturl': True,
        'simulate': True,
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
            info = ydl.extract_info(video_url, download=False)
            
            if not info:
                return jsonify({
                    "success": False,
                    "error": "Unable to extract video information"
                }), 500

            audio_url = info.get('url') or info.get('direct_url')
            if not audio_url:
                formats = info.get('formats', [])
                audio_formats = [f for f in formats if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
                if audio_formats:
                    audio_url = audio_formats[-1].get('url')
                else:
                    return jsonify({
                        "success": False,
                        "error": "No audio formats available"
                    }), 500

            thumbnails = info.get('thumbnails', [])
            thumbnail_url = ''
            if thumbnails:
                sorted_thumbs = sorted(thumbnails, key=lambda x: x.get('height', 0), reverse=True)
                thumbnail_url = sorted_thumbs[0].get('url', '')

            artist = (info.get('artist') or 
                     info.get('uploader') or 
                     info.get('channel') or 
                     'Unknown Artist')

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

@app.route('/face_auth')
def face_auth():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    return render_template('face_auth.html')

@app.route('/update_face_auth', methods=['POST'])
def update_face_auth():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    enable_face_auth = request.form.get('enableFaceAuth') == 'on'

    user_email = session['user_id']
    try:
        users_collection.update_one(
            {'email': user_email},
            {'$set': {'face_auth_enabled': enable_face_auth}}
        )
        return redirect(url_for('face_auth'))
    except Exception as e:
        print(f"Error updating face authentication: {e}")
        return "An error occurred while updating face authentication settings. Please try again later."


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
    frames = data.get('frames', [])
    username = data.get('username', 'unknown')
    
    # Create user-specific folder
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], username)
    if not os.path.exists(user_folder):
        os.makedirs(user_folder)
    
    # Save frames
    for i, frame in enumerate(frames):
        frame_data = frame.split(',')[1]
        frame_bytes = base64.b64decode(frame_data)
        frame_path = os.path.join(user_folder, f'frame_{i}.jpg')
        with open(frame_path, 'wb') as f:
            f.write(frame_bytes)
    
    # Train model and save as .pkl
    try:
        train_and_save_model(username, user_folder)
        return jsonify({'status': 'success', 'message': f'{len(frames)} frames saved and model trained'})
    except Exception as e:
        logging.error(f"Error processing frames for {username}: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error processing frames'}), 500

import base64

def train_and_save_model(username, user_folder):
    """Load images, generate face embeddings, save as .pkl file in MongoDB, and delete frames."""
    embeddings = []
    
    for i in range(100):
        frame_path = os.path.join(user_folder, f'frame_{i}.jpg')
        if not os.path.exists(frame_path):
            logging.warning(f"Frame {frame_path} not found")
            continue
            
        try:
            img = cv2.imread(frame_path)
            if img is None:
                logging.warning(f"Failed to load image {frame_path}")
                continue
            embedding = DeepFace.represent(img, model_name='VGG-Face', enforce_detection=False)
            if embedding:
                embeddings.append(embedding[0]['embedding'])
        except Exception as e:
            logging.error(f"Error processing frame {i} for {username}: {str(e)}")
            continue
    
    if not embeddings:
        raise Exception("No valid embeddings generated")
    
    avg_embedding = np.mean(embeddings, axis=0)
    
    # Save model to MongoDB
    try:
        # Create a dictionary for the model data
        model_data = {
            'username': username,
            'embedding': avg_embedding.tolist()  # Convert numpy array to list for MongoDB compatibility
        }
        
        # Serialize the model data to a pickle file in memory
        model_pickle = pickle.dumps(model_data)
        
        # Encode the pickle data to base64 for MongoDB storage
        model_base64 = base64.b64encode(model_pickle).decode('utf-8')
        
        # Store in MongoDB
        db.models.update_one(
            {'username': username},
            {'$set': {'model_data': model_base64}},
            upsert=True
        )
        logging.info(f"Model for {username} saved to MongoDB")
        
    except Exception as e:
        logging.error(f"Error saving model to MongoDB for {username}: {str(e)}")
        raise
    
    # Delete frames to save space
    try:
        for i in range(100):
            frame_path = os.path.join(user_folder, f'frame_{i}.jpg')
            if os.path.exists(frame_path):
                os.remove(frame_path)
                logging.info(f"Deleted frame {frame_path}")
        # Optionally, delete the user folder if empty
        if os.path.exists(user_folder) and not os.listdir(user_folder):
            os.rmdir(user_folder)
            logging.info(f"Deleted empty user folder {user_folder}")
    except Exception as e:
        logging.error(f"Error deleting frames for {username}: {str(e)}")




@app.route('/match_face', methods=['POST'])
def match_face():
    try:
        data = request.get_json()
        frame = data.get('frame')
        if not frame:
            return jsonify({'status': 'error', 'message': 'No frame provided'}), 400
        
        # Decode base64 frame
        frame_data = frame.split(',')[1]
        frame_bytes = base64.b64decode(frame_data)
        nparr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Generate embedding
        embedding = DeepFace.represent(img, model_name='VGG-Face', enforce_detection=False)
        if not embedding:
            return jsonify({'status': 'error', 'message': 'No face detected'})
        
        live_embedding = embedding[0]['embedding']
        
        # Load models from MongoDB\ collection
        best_match = None
        best_score = float('inf')
        threshold = 0.6  # Cosine distance threshold
        
        # Retrieve all models from MongoDB
        models = db.models.find()
        
        for model in models:
            try:
                # Decode base64 model data
                model_pickle = base64.b64decode(model['model_data'])
                model_data = pickle.loads(model_pickle)
                stored_embedding = np.array(model_data['embedding'])
                username = model_data['username']
                
                # Compute cosine distance
                score = cosine(live_embedding, stored_embedding)
                if score < best_score:
                    best_score = score
                    best_match = username
                
            except Exception as e:
                logging.error(f"Error processing model for {model.get('username', 'unknown')}: {str(e)}")
                continue
        
        if best_score < threshold:
            session['user_id'] = best_match  # Set session for dashboard
            return jsonify({'status': 'success', 'username': best_match, 'verified': True})
        else:
            return jsonify({'status': 'success', 'username': 'No Match', 'verified': False})
            
    except Exception as e:
        logging.error(f"Error matching face: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error matching face'}), 500

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
        # Start Flask in a separate thread
        from threading import Thread
        flask_thread = Thread(target=lambda: app.run(debug=True, use_reloader=False, port=5000))
        flask_thread.daemon = True
        flask_thread.start()
        
        # Create and start webview window
        webview.create_window("Spotify-3.0", "http://127.0.0.1:5000/")
        webview.start()
    else:
        print("Application cannot start due to database connection failure")
        sys.exit(1)
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from pymongo import MongoClient
# from passlib.context import CryptContext
from yt_dlp import YoutubeDL
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)
app.secret_key = 'REMOVED_SECRET_KEY'  # Change this to a more secure secret key

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

# Initialize Passlib context for scrypt
# pwd_context = CryptContext(schemes=["scrypt"], deprecated="auto")

# User class
class User:
    def __init__(self, user_id, email, password, library):
        self.user_id = user_id
        self.email = email
        self.password_hash = password
        self.library = library

    def check_password(self, password):
        # Verify password by direct comparison (no hashing)
        return self.password_hash == password

# Fetch user from MongoDB
def get_user_by_email(email):
    return users_collection.find_one({'email': email})

def fetch_mood_playlists(playlist_size=7):
    """Fetch mood-based playlists using yt-dlp."""
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
                        if entry:  # Check if entry is not None
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
                    mood_playlists[mood] = []  # Empty list for failed mood
                
        return mood_playlists
    
    except Exception as e:
        print(f"Error fetching mood playlists: {e}")
        return {}
                        

def fetch_trending():
    """Fetches trending music videos using yt-dlp."""
    try:
        options = {
            'quiet': True,
            'extract_flat': True,
            'playlist_items': '1-28',  # Fetch top 28 trending videos
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
                artist = entry.get('uploader', '')  # Try getting uploader first
                
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
            
            return trending_songs  # Return only the trending songs list
    except Exception as e:
        print(f"Error fetching trending: {e}")
        return []

# Login Route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        print(f"Login attempt for email: {email}")  # Debug log
        
        # Fetch user data from the database
        user_data = get_user_by_email(email)
        
        if user_data:
            print("User found in database")  # Debug log
            try:
                user = User(user_data['_id'], user_data['email'], user_data['password'], user_data['library'])
                if user.check_password(password):
                    print("Password verified successfully")  # Debug log
                    session['user_id'] = email
                    
                    # Check if request wants JSON response
                    if request.headers.get('Accept') == 'application/json':
                        return jsonify({
                            'success': True,
                            'redirect': url_for('dashboard'),
                            'library': user_data.get('library', [])
                        })
                    return redirect(url_for('dashboard'))
                else:
                    print("Password verification failed")  # Debug log
                    if request.headers.get('Accept') == 'application/json':
                        return jsonify({
                            'success': False,
                            'message': 'Invalid email or password'
                        })
                    return render_template('login.html', error="Invalid email or password")
            except Exception as e:
                print(f"Error during login: {str(e)}")  # Debug log
                if request.headers.get('Accept') == 'application/json':
                    return jsonify({
                        'success': False,
                        'message': 'An error occurred during login'
                    })
                return render_template('login.html', error="An error occurred during login")
        else:
            print("User not found in database")  # Debug log
            if request.headers.get('Accept') == 'application/json':
                return jsonify({
                    'success': False,
                    'message': 'Invalid email or password'
                })
            return render_template('login.html', error="Invalid email or password")
    
    return render_template('login.html')


# Signup Route
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
            print(f"Error during signup: {str(e)}")  # Debug log
            return 'An error occurred during signup'
            
    return render_template('signup.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)  # Manually remove user from session
    return redirect(url_for('login'))

@app.route('/')
def index():
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    # Check if user is logged in
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user_email = session['user_id']
    user_data = get_user_by_email(user_email)
    
    if not user_data:
        # If user data not found, log them out and redirect to login
        session.pop('user_id', None)
        return redirect(url_for('login'))
    
    trending_songs = fetch_trending()
    mood_playlists = fetch_mood_playlists()
    
    return render_template('dashboard.html', 
                         user_email=user_email,
                         user_library=user_data.get('library', []),
                         trending=trending_songs,
                         mood_playlists=mood_playlists)



@app.route('/play', methods=['POST'])
def play():
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
            'extract_flat': False,  # Changed to get full metadata
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
            }]
        }

        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                
                # Get the direct audio URL
                audio_url = info.get('url', None)
                if not audio_url:
                    raise Exception("No suitable audio format found")

                # Get thumbnail URL
                thumbnails = info.get('thumbnails', [])
                thumbnail_url = ''
                if thumbnails:
                    for thumb in thumbnails:
                        if thumb.get('height', 0) >= 180:
                            thumbnail_url = thumb['url']
                            break
                    if not thumbnail_url and thumbnails:
                        thumbnail_url = thumbnails[0]['url']

                # Get artist name
                artist = info.get('artist', info.get('channel', info.get('uploader', 'Unknown Artist')))

                # Return all metadata with the response
                return jsonify({
                    'success': True,
                    'audio_url': audio_url,
                    'title': info.get('title', 'Unknown Title'),
                    'thumbnail': thumbnail_url,
                    'artist': artist
                })

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
    """Search for a song on YouTube."""
    query = request.args.get('query')
    if not query:
        return jsonify([])

    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'extract_flat': True,
            'no_warnings': True,
            'default_search': 'ytsearch10',  # Get top 10 results
        }

        with YoutubeDL(ydl_opts) as ydl:
            # Add 'music' to the search query to get better music results
            search_query = f"ytsearch10:{query} music"
            info = ydl.extract_info(search_query, download=False)
            
            results = []
            for entry in info.get('entries', []):
                if not entry:
                    continue
                    
                # Get the best thumbnail
                thumbnails = entry.get('thumbnails', [])
                thumbnail_url = ''
                if thumbnails:
                    # Try to get a medium-quality thumbnail
                    for thumb in thumbnails:
                        if thumb.get('height', 0) >= 180:
                            thumbnail_url = thumb['url']
                            break
                    # If no medium thumbnail found, use the first available
                    if not thumbnail_url and thumbnails:
                        thumbnail_url = thumbnails[0]['url']

                # Parse title and artist
                full_title = entry.get('title', '')
                artist = entry.get('channel', entry.get('uploader', ''))
                
                # Try to separate artist and title if they're in the format "Artist - Title"
                if ' - ' in full_title:
                    parts = full_title.split(' - ', 1)
                    if len(parts) == 2:
                        artist = parts[0].strip()
                        title = parts[1].strip()
                    else:
                        title = full_title
                else:
                    title = full_title

                # Format duration
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
        
        # Add error handling for empty or invalid song data
        if not song_data or not isinstance(song_data, dict):
            return jsonify({
                'success': False,
                'message': 'Invalid song data'
            }), 400

        # Update user's library in MongoDB
        result = users_collection.update_one(
            {'email': user_email},
            {'$addToSet': {'library': song_data}}  # $addToSet prevents duplicates
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
        
        # Remove song from user's library in MongoDB
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
        # Test the connection
        client.admin.command('ping')
        print("✅ Successfully connected to MongoDB!")
        return True
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {str(e)}")
        print("Please check your connection string and make sure MongoDB Atlas is accessible.")
        return False

# Test connection before starting the app
if __name__ == '__main__':
    import platform
    if test_db_connection():  # Only start the app if DB connection is successful
        if platform.system() == 'Windows':
            # On Windows, disable the reloader to avoid socket errors
            app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
        else:
            app.run(host='0.0.0.0', port=5000, debug=True)
    else:
        print("Application startup cancelled due to database connection failure.")

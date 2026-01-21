from flask import Flask, render_template, request, session, jsonify, redirect, url_for, flash
from pymongo import MongoClient
import os
import sys
from dotenv import load_dotenv
from flask_cors import CORS
import logging
from functools import wraps
from datetime import timedelta
import bcrypt
import socket
from urllib.parse import unquote
import requests

# Load environment variables
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    load_dotenv(os.path.join(bundle_dir, '.env'))
else:
    # Load from parent directory's .env
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(parent_dir, '.env'))

# Flask app setup
app = Flask(__name__, 
            template_folder='templates',
            static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})
app.secret_key = os.getenv('ADMIN_SECRET_KEY', 'AdminSecretKey@Groovo2024')
app.permanent_session_lifetime = timedelta(hours=12)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Admin credentials from environment variables
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')

# MongoDB Atlas setup
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    logging.error("Error: MONGO_URI not found in environment variables")
    # In serverless environment, we can't exit - just log the error
    if not os.getenv('VERCEL'):
        sys.exit(1)

# GitHub Configuration for releases
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '')
GITHUB_REPO = os.getenv('GITHUB_REPO', 'Nikk-123/GROOVO')  # Default to your repository

# Initialize MongoDB connection
client = None
db = None
users_collection = None

try:
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=20000,
        connect=False  # Lazy connection for serverless
    )
    db = client.get_database('music_app')
    users_collection = db.users
    logging.info("MongoDB client initialized")
except Exception as e:
    logging.error(f"Failed to initialize MongoDB: {e}")
    # In serverless environment, we can't exit - connection will be attempted on first request
    if not os.getenv('VERCEL'):
        sys.exit(1)

# Admin authentication decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session:
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def index():
    """Redirect to admin login or dashboard"""
    if 'admin_logged_in' in session:
        return redirect(url_for('admin_dashboard'))
    return redirect(url_for('admin_login'))

@app.route('/login', methods=['GET', 'POST'])
def admin_login():
    """Admin login page"""
    if 'admin_logged_in' in session:
        return redirect(url_for('admin_dashboard'))
    
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            session.permanent = True
            logging.info(f"Admin logged in: {username}")
            return redirect(url_for('admin_dashboard'))
        else:
            error = "Invalid admin credentials"
            logging.warning(f"Failed admin login attempt for username: {username}")
    
    return render_template('admin_login.html', error=error)

@app.route('/logout')
@admin_required
def admin_logout():
    """Admin logout"""
    session.pop('admin_logged_in', None)
    logging.info("Admin logged out")
    return redirect(url_for('admin_login'))

@app.route('/dashboard')
@admin_required
def admin_dashboard():
    """Main admin dashboard"""
    return render_template('admin_dashboard.html')

@app.route('/analytics')
@admin_required
def analytics_page():
    """Analytics dashboard page"""
    return render_template('analytics.html')

# API Endpoints

# ===== ANALYTICS API ENDPOINTS =====

@app.route('/api/analytics/overview')
@admin_required
def analytics_overview():
    """Get overall analytics overview"""
    try:
        from datetime import datetime, timedelta
        
        # Access analytics collections
        listening_history = db.listening_history
        current_sessions = db.current_sessions
        
        # Total plays
        total_plays = listening_history.count_documents({'event_type': 'play'})
        
        # Unique listeners (all time)
        unique_listeners = len(listening_history.distinct('user_email'))
        
        # Active users (last 24h)
        yesterday = datetime.utcnow() - timedelta(days=1)
        active_24h = len(listening_history.distinct('user_email', {'timestamp': {'$gte': yesterday}}))
        
        # Active users (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        active_7d = len(listening_history.distinct('user_email', {'timestamp': {'$gte': week_ago}}))
        
        # Currently listening
        currently_listening = current_sessions.count_documents({'status': 'playing'})
        
        # Average listen time
        pipeline = [
            {'$match': {'event_type': {'$in': ['complete', 'skip']}}},
            {'$group': {'_id': None, 'avg_duration': {'$avg': '$listen_duration'}}}
        ]
        avg_result = list(listening_history.aggregate(pipeline))
        avg_listen_time = round(avg_result[0]['avg_duration'], 2) if avg_result else 0
        
        return jsonify({
            'success': True,
            'overview': {
                'total_plays': total_plays,
                'unique_listeners': unique_listeners,
                'active_24h': active_24h,
                'active_7d': active_7d,
                'currently_listening': currently_listening,
                'avg_listen_time': avg_listen_time
            }
        })
    except Exception as e:
        logging.error(f"Error getting analytics overview: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/analytics/top-songs')
@admin_required
def analytics_top_songs():
    """Get most played songs with pagination"""
    try:
        listening_history = db.listening_history
        limit = int(request.args.get('limit', 10))
        page = int(request.args.get('page', 1))
        skip = (page - 1) * limit
        
        pipeline = [
            {'$match': {
                'event_type': 'play',
                'song': {'$exists': True},
                'song.url': {'$exists': True, '$ne': None},
                'song.title': {'$exists': True, '$ne': None}
            }},
            {'$group': {
                '_id': '$song.url',
                'title': {'$first': '$song.title'},
                'artist': {'$first': '$song.artist'},
                'thumbnail': {'$first': '$song.thumbnail'},
                'play_count': {'$sum': 1},
                'unique_listeners': {'$addToSet': '$user_email'}
            }},
            {'$project': {
                '_id': 0,
                'url': '$_id',
                'title': 1,
                'artist': 1,
                'thumbnail': 1,
                'play_count': 1,
                'unique_listeners': {'$size': '$unique_listeners'}
            }},
            {'$sort': {'play_count': -1}},
            {'$skip': skip},
            {'$limit': limit}
        ]
        
        top_songs = list(listening_history.aggregate(pipeline))
        
        return jsonify({
            'success': True,
            'top_songs': top_songs,
            'page': page,
            'limit': limit
        })
        })
    except Exception as e:
        logging.error(f"Error getting top songs: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/analytics/listening-patterns')
@admin_required
def analytics_listening_patterns():
    """Get listening patterns by hour and day with week navigation"""
    try:
        from datetime import datetime, timedelta
        listening_history = db.listening_history
        
        # Get week offset (0 = current week, -1 = last week, etc.)
        week_offset = int(request.args.get('week_offset', 0))
        
        # Calculate start and end of the target week (Monday to Sunday)
        today = datetime.utcnow()
        current_monday = today - timedelta(days=today.weekday())
        current_monday = current_monday.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Target week start (Monday)
        target_start = current_monday + timedelta(weeks=week_offset)
        
        # Target week end (Next Monday)
        target_end = target_start + timedelta(weeks=1)
        
        # Hourly breakdown
        pipeline_hourly = [
            {'$match': {
                'event_type': 'play', 
                'timestamp': {'$gte': target_start, '$lt': target_end}
            }},
            {'$project': {
                'hour': {'$hour': '$timestamp'}
            }},
            {'$group': {
                '_id': '$hour',
                'count': {'$sum': 1}
            }},
            {'$sort': {'_id': 1}}
        ]
        
        hourly_data = list(listening_history.aggregate(pipeline_hourly))
        
        # Initialize all hours with 0
        hourly_breakdown = {str(h): 0 for h in range(24)}
        for item in hourly_data:
            hourly_breakdown[str(item['_id'])] = item['count']
        
        # Daily breakdown (day of week)
        pipeline_daily = [
            {'$match': {
                'event_type': 'play', 
                'timestamp': {'$gte': target_start, '$lt': target_end}
            }},
            {'$project': {
                'dayOfWeek': {'$dayOfWeek': '$timestamp'}
            }},
            {'$group': {
                '_id': '$dayOfWeek',
                'count': {'$sum': 1}
            }},
            {'$sort': {'_id': 1}}
        ]
        
        daily_data = list(listening_history.aggregate(pipeline_daily))
        
        # Map day numbers to names
        day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        daily_breakdown = {day: 0 for day in day_names}
        for item in daily_data:
            day_index = item['_id'] - 1  # MongoDB dayOfWeek is 1-indexed (1=Sunday)
            daily_breakdown[day_names[day_index]] = item['count']
        
        return jsonify({
            'success': True,
            'patterns': {
                'hourly': hourly_breakdown,
                'daily': daily_breakdown
            },
            'period': {
                'start': target_start.strftime('%Y-%m-%d'),
                'end': (target_end - timedelta(seconds=1)).strftime('%Y-%m-%d'),
                'is_current_week': week_offset == 0
            }
        })
    except Exception as e:
        logging.error(f"Error getting listening patterns: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/analytics/currently-listening')
@admin_required
def analytics_currently_listening():
    """Get users currently listening to music"""
    try:
        current_sessions = db.current_sessions
        
        sessions = list(current_sessions.find(
            {'status': 'playing', 'song': {'$exists': True}},
            {'_id': 0}
        ))
        
        # Convert datetime to string for JSON
        for session in sessions:
            if 'started_at' in session:
                session['started_at'] = session['started_at'].isoformat()
            if 'last_updated' in session:
                session['last_updated'] = session['last_updated'].isoformat()
        
        return jsonify({
            'success': True,
            'sessions': sessions,
            'count': len(sessions)
        })
    except Exception as e:
        logging.error(f"Error getting currently listening: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/analytics/user-activity/<email>')
@admin_required
def analytics_user_activity(email):
    """Get activity for a specific user"""
    email = unquote(email)  # Decode URL-encoded email
    try:
        from datetime import datetime, timedelta
        listening_history = db.listening_history
        
        # Last 30 days
        month_ago = datetime.utcnow() - timedelta(days=30)
        
        # User's top songs
        pipeline_top = [
            {'$match': {'user_email': email, 'event_type': 'play', 'timestamp': {'$gte': month_ago}}},
            {'$group': {
                '_id': '$song.url',
                'title': {'$first': '$song.title'},
                'artist': {'$first': '$song.artist'},
                'play_count': {'$sum': 1}
            }},
            {'$sort': {'play_count': -1}},
            {'$limit': 10}
        ]
        
        top_songs = list(listening_history.aggregate(pipeline_top))
        
        # Total plays
        total_plays = listening_history.count_documents({
            'user_email': email,
            'event_type': 'play',
            'timestamp': {'$gte': month_ago}
        })
        
        # Recent activity
        recent = list(listening_history.find(
            {'user_email': email, 'event_type': 'play'},
            {'_id': 0, 'song': 1, 'timestamp': 1}
        ).sort('timestamp', -1).limit(20))
        
        # Convert timestamps
        for item in recent:
            if 'timestamp' in item:
                item['timestamp'] = item['timestamp'].isoformat()
        
        return jsonify({
            'success': True,
            'activity': {
                'email': email,
                'total_plays_30d': total_plays,
                'top_songs': top_songs,
                'recent_plays': recent
            }
        })
    except Exception as e:
        logging.error(f"Error getting user activity: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/stats')
@admin_required
def get_stats():
    """Get overall statistics"""
    try:
        total_users = users_collection.count_documents({})
        
        # Calculate total songs across all libraries
        pipeline = [
            {"$project": {"library_count": {"$size": {"$ifNull": ["$library", []]}}}},
            {"$group": {"_id": None, "total_songs": {"$sum": "$library_count"}}}
        ]
        result = list(users_collection.aggregate(pipeline))
        total_songs = result[0]['total_songs'] if result else 0
        
        # Get most popular songs (songs that appear in multiple libraries)
        pipeline = [
            {"$unwind": "$library"},
            {"$group": {
                "_id": "$library.url",
                "title": {"$first": "$library.title"},
                "artist": {"$first": "$library.artist"},
                "thumbnail": {"$first": "$library.thumbnail"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        popular_songs = list(users_collection.aggregate(pipeline))
        
        return jsonify({
            'success': True,
            'stats': {
                'total_users': total_users,
                'total_songs': total_songs,
                'avg_songs_per_user': round(total_songs / total_users, 2) if total_users > 0 else 0,
                'popular_songs': popular_songs
            }
        })
    except Exception as e:
        logging.error(f"Error getting stats: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users')
@admin_required
def get_all_users():
    """Get all users with basic info"""
    try:
        search_query = request.args.get('search', '').strip()
        
        # Build query
        query = {}
        if search_query:
            query['email'] = {'$regex': search_query, '$options': 'i'}
        
        users = list(users_collection.find(query, {
            'email': 1,
            'library': 1,
            'face_auth_enabled': 1,
            '_id': 0
        }))
        
        # Format user data
        user_list = []
        for user in users:
            user_list.append({
                'email': user.get('email', 'N/A'),
                'library_count': len(user.get('library', [])),
                'face_auth_enabled': user.get('face_auth_enabled', False)
            })
        
        return jsonify({
            'success': True,
            'users': user_list,
            'total': len(user_list)
        })
    except Exception as e:
        logging.error(f"Error getting users: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/user/<email>')
@admin_required
def get_user_details(email):
    """Get detailed information for a specific user"""
    email = unquote(email)  # Decode URL-encoded email
    try:
        user = users_collection.find_one({'email': email}, {'password': 0, '_id': 0})
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'user': {
                'email': user.get('email', 'N/A'),
                'library': user.get('library', []),
                'library_count': len(user.get('library', [])),
                'face_auth_enabled': user.get('face_auth_enabled', False)
            }
        })
    except Exception as e:
        logging.error(f"Error getting user details: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/user/<email>/library')
@admin_required
def get_user_library(email):
    """Get user's complete library"""
    email = unquote(email)  # Decode URL-encoded email
    try:
        user = users_collection.find_one({'email': email}, {'library': 1, '_id': 0})
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        library = user.get('library', [])
        
        return jsonify({
            'success': True,
            'email': email,
            'library': library,
            'count': len(library)
        })
    except Exception as e:
        logging.error(f"Error getting user library: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/releases/latest')
@admin_required
def get_latest_release():
    """Get the latest GitHub release information"""
    try:
        headers = {}
        if GITHUB_TOKEN:
            headers['Authorization'] = f'token {GITHUB_TOKEN}'
            headers['Accept'] = 'application/vnd.github.v3+json'
        
        # GitHub API endpoint for latest release
        api_url = f'https://api.github.com/repos/{GITHUB_REPO}/releases/latest'
        
        logging.info(f"Fetching latest release from: {api_url}")
        response = requests.get(api_url, headers=headers, timeout=10)
        
        if response.status_code == 404:
            return jsonify({
                'success': False,
                'message': 'No releases found for this repository'
            }), 404
        
        if response.status_code != 200:
            logging.error(f"GitHub API error: {response.status_code} - {response.text}")
            return jsonify({
                'success': False,
                'message': f'GitHub API error: {response.status_code}'
            }), response.status_code
        
        release_data = response.json()
        
        # Extract relevant information
        release_info = {
            'version': release_data.get('tag_name', 'Unknown'),
            'name': release_data.get('name', 'Unknown'),
            'published_at': release_data.get('published_at', ''),
            'body': release_data.get('body', ''),
            'html_url': release_data.get('html_url', ''),
            'assets': []
        }
        
        # Extract EXE file information
        for asset in release_data.get('assets', []):
            if asset.get('name', '').endswith('.exe'):
                release_info['assets'].append({
                    'name': asset.get('name', ''),
                    'size': asset.get('size', 0),
                    'download_url': asset.get('browser_download_url', ''),
                    'download_count': asset.get('download_count', 0)
                })
        
        return jsonify({
            'success': True,
            'release': release_info
        })
        
    except requests.exceptions.Timeout:
        logging.error("GitHub API request timed out")
        return jsonify({
            'success': False,
            'message': 'Request to GitHub API timed out'
        }), 504
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching GitHub release: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error connecting to GitHub: {str(e)}'
        }), 500
    except Exception as e:
        logging.error(f"Unexpected error getting latest release: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    logging.error(f"Internal error: {str(error)}")
    return jsonify({'success': False, 'message': 'Internal server error'}), 500

def get_available_port():
    """Find and return an available port number"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('', 0))  # Bind to any available port
    port = sock.getsockname()[1]
    sock.close()
    return port

if __name__ == '__main__':
    # Use 0 for automatic port assignment, or specify a port via ADMIN_PORT env variable
    port = int(os.environ.get('ADMIN_PORT', 0))
    
    if port == 0:
        # Find an available port automatically
        port = get_available_port()
        logging.info(f"Using automatic port assignment: {port}")
    else:
        logging.info(f"Using specified port: {port}")
    
    # Run the app
    logging.info(f"Admin panel starting on http://localhost:{port}")
    app.run(debug=True, host='0.0.0.0', port=port)

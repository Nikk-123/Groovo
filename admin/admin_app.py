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
    sys.exit(1)

try:
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=20000,
        connect=True
    )
    db = client.get_database('music_app')
    users_collection = db.users
    logging.info("Successfully connected to MongoDB")
except Exception as e:
    logging.error(f"Failed to connect to MongoDB: {e}")
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

# API Endpoints
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

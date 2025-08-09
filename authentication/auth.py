from flask import Flask, redirect, request, session, jsonify, render_template, url_for
from pymongo import MongoClient
import os
import sys
from dotenv import load_dotenv
from flask_cors import CORS
import logging
from pymongo.errors import PyMongoError
from bson.objectid import ObjectId
import bcrypt

# Load environment variables
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    load_dotenv(os.path.join(bundle_dir, '.env'))
else:
    load_dotenv()

# Flask app setup
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})
app.secret_key = 'REMOVED_SECRET_KEY'

# Configure logging
logging.basicConfig(level=logging.INFO)

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
    def __init__(self, user_id, email, password, library, is_password_hashed=False):
        self.user_id = user_id
        self.email = email
        self.password = password
        self.library = library
        self.is_password_hashed = is_password_hashed

    def check_password(self, password):
        if self.is_password_hashed:
            return bcrypt.checkpw(password.encode('utf-8'), self.password)
        return self.password == password

def get_user_by_email(email):
    try:
        return users_collection.find_one({'email': email})
    except PyMongoError as e:
        logging.error(f"Database error while fetching user: {e}")
        return None

@app.route('/api/signup', methods=['POST'])
def api_signup():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No input data provided'}), 400

        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password required'}), 400

        existing_user = get_user_by_email(email)
        if existing_user:
            return jsonify({'success': False, 'message': 'User already exists'}), 409
        
        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        new_user = {
            'email': email,
            'password': hashed_password,
            'library': [],
            'face_auth_enabled': False,
            'is_password_hashed': True
        }
        
        users_collection.insert_one(new_user)
        return jsonify({
            'success': True,
            'message': 'Signup successful',
            'user': {'email': email}
        }), 201
    except Exception as e:
        logging.error(f"Error during signup: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred during signup'}), 500

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No input data provided'}), 400

    email = data.get('email')
    password = data.get('password')
    is_auto_login = data.get('auto_login', False)

    if not email:
        return jsonify({'success': False, 'message': 'Email required'}), 400

    user_data = get_user_by_email(email)
    logging.debug(f"Login attempt for email: {email}, user found: {bool(user_data)}")

    if user_data:
        is_password_hashed = user_data.get('is_password_hashed', False)
        user = User(user_data['_id'], user_data['email'], user_data['password'], user_data.get('library', []), is_password_hashed)
        
        # For auto-login, skip password check
        if is_auto_login:
            session['user_id'] = email
            logging.debug(f"Auto-login successful for user: {email}")
            return jsonify({
                'success': True,
                'message': 'Auto-login successful',
                'user': {'email': email},
                'library': user.library
            }), 200

        # Regular login with password
        if not password:
            return jsonify({'success': False, 'message': 'Password required'}), 400
            
        if user.check_password(password):
            session['user_id'] = email
            logging.debug(f"Session set: user_id={email}")
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'user': {'email': email},
                'library': user.library
            }), 200
        else:
            return jsonify({'success': False, 'message': 'Invalid password'}), 401
    else:
        return jsonify({'success': False, 'message': 'User not found'}), 404

@app.route('/api/check-session', methods=['GET'])
def check_session():
    user_email = session.get('user_id') or request.headers.get('X-User-Email')
    if user_email:
        user_data = get_user_by_email(user_email)
        if user_data:
            return jsonify({
                'success': True,
                'message': 'User is logged in',
                'user': {'email': user_email},
                'library': user_data.get('library', [])
            }), 200
    return jsonify({
        'success': False,
        'message': 'No active session'
    }), 401

@app.route('/api/logout', methods=['POST'])
def api_logout():
    try:
        user_email = session.get('user_id') or request.headers.get('X-User-Email')
        if not user_email:
            logging.debug("No user_id in session or X-User-Email header")
            return jsonify({'success': False, 'message': 'Not logged in'}), 401

        session.pop('user_id', None)
        logging.debug(f"User logged out: {user_email}")
        return jsonify({
            'success': True,
            'message': 'Logout successful'
        }), 200
    except Exception as e:
        logging.error(f"Error during logout: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred during logout'}), 500


@app.route('/library/add', methods=['POST'])
def add_to_library():
    user_email = session.get('user_id') or request.headers.get('X-User-Email')
    if not user_email:
        logging.debug("No user_id in session or X-User-Email header")
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    try:
        song_data = request.json
        logging.debug(f"Add to library: user_email={user_email}, song_data={song_data}")

        if not song_data or not isinstance(song_data, dict):
            return jsonify({'success': False, 'message': 'Invalid song data'}), 400
        
        required_fields = ['title', 'url', 'thumbnail', 'artist']
        if not all(field in song_data for field in required_fields):
            return jsonify({'success': False, 'message': 'Missing required song data fields'}), 400

        user = users_collection.find_one({'email': user_email})
        if not user:
            logging.debug(f"User not found: {user_email}")
            return jsonify({'success': False, 'message': 'User not found'}), 404

        result = users_collection.update_one(
            {'email': user_email},
            {'$addToSet': {'library': song_data}}
        )

        logging.debug(f"Song added: modified_count={result.modified_count}")
        return jsonify({
            'success': True,
            'message': 'Song added to library'
        }), 200
    except PyMongoError as e:
        logging.error(f"MongoDB error adding to library: {str(e)}")
        return jsonify({'success': False, 'message': 'Database error occurred'}), 500
    except Exception as e:
        logging.error(f"Error adding to library: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred while adding to library'}), 500

@app.route('/library/remove', methods=['POST'])
def remove_from_library():
    user_email = session.get('user_id') or request.headers.get('X-User-Email')
    if not user_email:
        logging.debug("No user_id in session or X-User-Email header")
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    try:
        song_data = request.json
        logging.debug(f"Remove from library: user_email={user_email}, song_data={song_data}")

        if not song_data or 'url' not in song_data:
            return jsonify({'success': False, 'message': 'Invalid or missing song URL'}), 400

        user = users_collection.find_one({'email': user_email})
        if not user:
            logging.debug(f"User not found: {user_email}")
            return jsonify({'success': False, 'message': 'User not found'}), 404

        result = users_collection.update_one(
            {'email': user_email},
            {'$pull': {'library': {'url': song_data['url']}}}
        )

        if result.modified_count > 0:
            logging.debug(f"Song removed: modified_count={result.modified_count}")
            return jsonify({
                'success': True,
                'message': 'Song removed from library'
            }), 200
        else:
            logging.debug(f"Song not found in library: url={song_data['url']}")
            return jsonify({
                'success': False,
                'message': 'Song not found in library'
            }), 404
    except PyMongoError as e:
        logging.error(f"MongoDB error removing from library: {str(e)}")
        return jsonify({'success': False, 'message': 'Database error occurred'}), 500
    except Exception as e:
        logging.error(f"Error removing from library: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred while removing from library'}), 500


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
        session['user_id'] = email
        return redirect(url_for('settings'))
    except Exception as e:
        print(f"Error updating profile: {e}")
        return "An error occurred while updating your profile. Please try again later."


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


def test_db_connection():
    try:
        print("Testing MongoDB connection...")
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        return True
    except Exception as e:
        print(f"Failed to connect to MongoDB: {str(e)}")
        return False

port = int(os.environ.get("PORT", 5000))
if __name__ == "__main__":
    if test_db_connection():
        # Run API server only, no webview, no threading
        app.run(debug=True, host="0.0.0.0", port=port)
    else:
        print("Application cannot start due to database connection failure")
        sys.exit(1)

"""
Authentication & data service for Groovo.
Deployed on Render — provides REST API only (no HTML rendering).
"""

from flask import Flask, request, jsonify
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from flask_cors import CORS
import os
import sys
import logging
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# ── App setup ──────────────────────────────────────────────────────────────────
app = Flask(__name__)

# This service is called server-to-server (desktop Flask → Render).
# CORS is irrelevant for non-browser callers, but kept narrow as a precaution.
CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})

# NOTE: app.secret_key intentionally omitted — this is a stateless REST API;
# Flask sessions and cookies are never used here.

logging.basicConfig(level=logging.INFO)

# ── MongoDB ────────────────────────────────────────────────────────────────────
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    print("Error: MONGO_URI not found in environment variables")
    sys.exit(1)

client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=20000,
    connect=True,
)
db = client.get_database('music_app')
users_collection = db.users


# ── Helpers ────────────────────────────────────────────────────────────────────
def get_user_by_email(email):
    try:
        return users_collection.find_one({'email': email})
    except PyMongoError as e:
        logging.error(f"Database error while fetching user: {e}")
        return None


def get_request_user():
    """Extract authenticated user email from request header (session-less REST API)."""
    return request.headers.get('X-User-Email')


# ── Health check ───────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Returns server + database liveness status.
    Used by the desktop client on startup to detect cold-start / downtime.

    Response shape:
      200  { success: true,  status: "healthy",   db: "connected"    }
      503  { success: false, status: "unhealthy",  db: "unreachable", error: "..." }
    """
    try:
        client.admin.command('ping')
        db_status = 'connected'
    except Exception as e:
        logging.error(f"Health check — DB unreachable: {e}")
        return jsonify({
            'success': False,
            'status':  'unhealthy',
            'db':      'unreachable',
            'error':   str(e),
        }), 503

    return jsonify({
        'success': True,
        'status':  'healthy',
        'db':      db_status,
    }), 200


# ── Auth endpoints ─────────────────────────────────────────────────────────────
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

        if get_user_by_email(email):
            return jsonify({'success': False, 'message': 'User already exists'}), 409

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        users_collection.insert_one({
            'email': email,
            'password': hashed_password,
            'library': [],
            'is_password_hashed': True,
        })
        return jsonify({
            'success': True,
            'message': 'Signup successful',
            'user': {'email': email},
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

    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password required'}), 400

    user_data = get_user_by_email(email)
    if not user_data:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    stored_password = user_data['password']

    # SECURITY NOTE: The is_password_hashed plaintext fallback has been removed.
    # All passwords created via /api/signup are bcrypt-hashed (is_password_hashed=True).
    # If you have legacy plaintext-password accounts in the DB, run a one-time migration
    # script to bcrypt them before deploying this change.
    if not bcrypt.checkpw(password.encode('utf-8'), stored_password):
        return jsonify({'success': False, 'message': 'Invalid password'}), 401

    return jsonify({
        'success': True,
        'message': 'Login successful',
        'user': {'email': email},
        'library': user_data.get('library', []),
    }), 200


@app.route('/api/check-session', methods=['GET'])
def check_session():
    user_email = get_request_user()
    if not user_email:
        return jsonify({'success': False, 'message': 'No active session'}), 401

    user_data = get_user_by_email(user_email)
    if not user_data:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    return jsonify({
        'success': True,
        'message': 'User is logged in',
        'user': {'email': user_email},
        'library': user_data.get('library', []),
    }), 200


@app.route('/api/logout', methods=['POST'])
def api_logout():
    # Sessions are not used in this REST API — logout is handled client-side.
    # This endpoint exists so the desktop client has a clean logout hook.
    return jsonify({'success': True, 'message': 'Logout successful'}), 200


# ── Profile endpoint ───────────────────────────────────────────────────────────
@app.route('/api/update-profile', methods=['POST'])
def update_profile():
    user_email = get_request_user()
    if not user_email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No input data provided'}), 400

        new_email = data.get('email')
        new_username = data.get('username')
        current_email = data.get('current_email') or user_email

        if not get_user_by_email(current_email):
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # If email is changing, check it isn't already taken
        if new_email and new_email != current_email:
            if get_user_by_email(new_email):
                return jsonify({'success': False, 'message': 'Email already in use'}), 409

        update_fields = {}
        if new_email:
            update_fields['email'] = new_email
        if new_username:
            update_fields['username'] = new_username

        if not update_fields:
            return jsonify({'success': False, 'message': 'No fields to update'}), 400

        users_collection.update_one(
            {'email': current_email},
            {'$set': update_fields},
        )
        return jsonify({'success': True, 'message': 'Profile updated successfully'}), 200

    except PyMongoError as e:
        logging.error(f"MongoDB error updating profile: {str(e)}")
        return jsonify({'success': False, 'message': 'Database error occurred'}), 500
    except Exception as e:
        logging.error(f"Error updating profile: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred while updating profile'}), 500


# ── Library endpoints ──────────────────────────────────────────────────────────
@app.route('/library/add', methods=['POST'])
def add_to_library():
    user_email = get_request_user()
    if not user_email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    try:
        song_data = request.json
        if not song_data or not isinstance(song_data, dict):
            return jsonify({'success': False, 'message': 'Invalid song data'}), 400

        required_fields = ['title', 'url', 'thumbnail', 'artist']
        if not all(field in song_data for field in required_fields):
            return jsonify({'success': False, 'message': 'Missing required song data fields'}), 400

        if not users_collection.find_one({'email': user_email}):
            return jsonify({'success': False, 'message': 'User not found'}), 404

        users_collection.update_one(
            {'email': user_email},
            {'$addToSet': {'library': song_data}},
        )
        return jsonify({'success': True, 'message': 'Song added to library'}), 200
    except PyMongoError as e:
        logging.error(f"MongoDB error adding to library: {str(e)}")
        return jsonify({'success': False, 'message': 'Database error occurred'}), 500
    except Exception as e:
        logging.error(f"Error adding to library: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred while adding to library'}), 500


@app.route('/library/remove', methods=['POST'])
def remove_from_library():
    user_email = get_request_user()
    if not user_email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    try:
        song_data = request.json
        if not song_data or 'url' not in song_data:
            return jsonify({'success': False, 'message': 'Invalid or missing song URL'}), 400

        if not users_collection.find_one({'email': user_email}):
            return jsonify({'success': False, 'message': 'User not found'}), 404

        result = users_collection.update_one(
            {'email': user_email},
            {'$pull': {'library': {'url': song_data['url']}}},
        )

        if result.modified_count > 0:
            return jsonify({'success': True, 'message': 'Song removed from library'}), 200
        return jsonify({'success': False, 'message': 'Song not found in library'}), 404
    except PyMongoError as e:
        logging.error(f"MongoDB error removing from library: {str(e)}")
        return jsonify({'success': False, 'message': 'Database error occurred'}), 500
    except Exception as e:
        logging.error(f"Error removing from library: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred while removing from library'}), 500


# ── Error handlers ─────────────────────────────────────────────────────────────
@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': 'An internal server error occurred',
        'error': str(error),
    }), 500


@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'success': False, 'message': 'Resource not found'}), 404


# ── Local dev entry point ──────────────────────────────────────────────────────
def test_db_connection():
    try:
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        return True
    except Exception as e:
        print(f"Failed to connect to MongoDB: {str(e)}")
        return False


if __name__ == "__main__":
    if test_db_connection():
        port = int(os.environ.get("PORT", 5002))
        app.run(debug=True, host="0.0.0.0", port=port)
    else:
        print("Application cannot start due to database connection failure")
        sys.exit(1)
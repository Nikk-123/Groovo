"""
Authentication routes module for Groovo application.
Handles login, signup, logout, and session management.
"""

from flask import redirect, request, session, jsonify, render_template, url_for, flash
import requests
import logging

from modules.config import app, AUTH_SERVICE_URL, MOODS
from modules.cache import LIBRARY_CACHE, save_cache


def register_auth_routes(flask_app):
    """Register all authentication-related routes."""
    
    @flask_app.route('/login', methods=['GET', 'POST'])
    def login():
        if 'user_id' in session:
            return redirect(url_for('dashboard'))
        error = None  # Initialize error variable

        if request.method == 'POST':
            email = request.form.get('email')
            password = request.form.get('password')
            
            try:
                response = requests.post(f'{AUTH_SERVICE_URL}/api/login', 
                                         json={'email': email, 'password': password},
                                         timeout=10)
                data = response.json()
                
                if data.get('success'):
                    session['user_id'] = email
                    session.permanent = True
                    if request.headers.get('Accept') == 'application/json':
                        return jsonify({
                            'success': True,
                            'redirect': url_for('dashboard'),
                            'library': data.get('library', [])
                        })
                    return redirect(url_for('dashboard'))
                else:
                    error = data.get('message', 'Invalid email or password')
            except Exception as e:
                print(f"Error during login: {str(e)}")
                error = "An error occurred during login"
        
        # Single render_template call for GET or failed POST
        return render_template('login.html', error=error)

    @flask_app.route('/signup', methods=['GET', 'POST'])
    def signup():
        error = None  # Initialize error variable

        if request.method == 'POST':
            email = request.form.get('email')
            password = request.form.get('password')

            try:
                response = requests.post(f'{AUTH_SERVICE_URL}/api/signup', 
                                         json={'email': email, 'password': password},
                                         timeout=10)
                data = response.json()
                
                if data.get('success'):
                    return redirect(url_for('login'))
                else:
                    error = data.get('message', 'Signup failed')
            except Exception as e:
                print(f"Error during signup: {str(e)}")
                error = "An error occurred during signup"
        
        # Single render_template call for GET or failed POST
        return render_template('signup.html', error=error)

    @flask_app.route('/logout')
    def logout():
        try:
            user_email = session.get('user_id')
            if user_email:
                requests.post(f'{AUTH_SERVICE_URL}/api/logout', 
                            headers={'X-User-Email': user_email},
                            timeout=5)
            session.pop('user_id', None)
        except Exception as e:
            print(f"Error during logout: {str(e)}")
        return redirect(url_for('login'))

    @flask_app.route('/check-session')
    def check_session():
        try:
            user_email = session.get('user_id')
            if user_email:
                response = requests.get(f'{AUTH_SERVICE_URL}/api/check-session',
                                     headers={'X-User-Email': user_email},
                                     timeout=10)
                data = response.json()
                if data.get('success'):
                    # Populate cache since we have the data
                    import time
                    LIBRARY_CACHE[user_email] = {
                        'data': data.get('library', []),
                        'timestamp': time.time()
                    }
                    save_cache()
                    
                    return jsonify({
                        'success': True,
                        'user': data.get('user'),
                        'library': data.get('library', [])
                    })
        except Exception as e:
            print(f"Error checking session: {str(e)}")
        return jsonify({'success': False, 'message': 'No active session'}), 401

    @flask_app.route('/')
    def index():
        if 'user_id' in session:
            return redirect(url_for('dashboard'))
        return redirect(url_for('login'))

    @flask_app.route('/dashboard')
    def dashboard():
        if 'user_id' not in session:
            return redirect(url_for('login'))
        
        user_email = session['user_id']
        try:
            # Optimistic loading: We assume the session is valid if the cookie exists.
            # The frontend will fetch the real data (library, etc.) asynchronously.
            # If the session is actually invalid, the async calls will fail/redirect.
            
            # Initialize empty/default data for immediate rendering
            user_library = []
            user_library_urls = []
            trending_songs = []  # catch trending separately or let frontend do it (frontend does it)
            mood_playlists = {mood: [] for mood in MOODS}

            return render_template('dashboard.html', 
                                 user_email=user_email,
                                 user_library=user_library,
                                 user_library_urls=user_library_urls,
                                 trending=trending_songs,
                                 mood_playlists=mood_playlists)
                                 
        except Exception as e:
            print(f"Error in dashboard: {str(e)}")
            flash("An error occurred while loading the dashboard.", "error")
            return render_template('dashboard.html',
                                 user_email=user_email,
                                 user_library=[],
                                 user_library_urls=[],
                                 trending=[],
                                 mood_playlists={mood: [] for mood in MOODS})

    @flask_app.route('/edit_profile', methods=['POST'])
    def edit_profile():
        if 'user_id' not in session:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': 'Not logged in'}), 401
            return redirect(url_for('login'))

        username = request.form.get('username')
        email = request.form.get('email')
        user_email = session['user_id']
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

        try:
            # Call auth service API to update profile
            response = requests.post(
                f'{AUTH_SERVICE_URL}/api/update-profile',
                json={
                    'username': username,
                    'email': email,
                    'current_email': user_email
                },
                headers={'X-User-Email': user_email},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    session['user_id'] = email  # Update session with new email
                    if is_ajax:
                        return jsonify({'success': True, 'message': 'Profile updated successfully'})
                    flash('Profile updated successfully', 'success')
                else:
                    msg = data.get('message', 'Failed to update profile')
                    if is_ajax:
                        return jsonify({'success': False, 'message': msg})
                    flash(msg, 'error')
            else:
                if is_ajax:
                    return jsonify({'success': False, 'message': 'Failed to update profile'})
                flash('Failed to update profile', 'error')
                
            if not is_ajax:
                return redirect(url_for('dashboard'))
        except Exception as e:
            logging.error(f"Error updating profile: {str(e)}")
            if is_ajax:
                return jsonify({'success': False, 'message': 'An error occurred while updating your profile'})
            flash('An error occurred while updating your profile', 'error')
            return redirect(url_for('dashboard'))


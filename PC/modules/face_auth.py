"""
Face authentication module for Groovo application.
Handles face recognition features and related routes.
"""

from flask import redirect, request, session, jsonify, render_template, url_for, flash
import requests
import logging

from modules.config import FACE_SERVICE_URL, AUTH_SERVICE_URL

# In-memory storage for users
users = []


def register_face_auth_routes(flask_app):
    """Register all face authentication routes and error handlers."""
    
    @flask_app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            'success': False,
            'message': 'An internal server error occurred',
            'error': str(error)
        }), 500

    @flask_app.errorhandler(404)
    def not_found_error(error):
        return jsonify({
            'success': False,
            'message': 'Resource not found'
        }), 404

    @flask_app.route('/face_auth')
    def face_auth():
        if 'user_id' not in session:
            return redirect(url_for('login'))
        
        user_email = session['user_id']
        try:
            # Get user data from auth service
            response = requests.get(f'{AUTH_SERVICE_URL}/api/check-session',
                                 headers={'X-User-Email': user_email})
            data = response.json()
            
            if not data.get('success'):
                session.pop('user_id', None)
                return redirect(url_for('login'))
            
            user_data = data.get('user', {})
            
            # Check face model
            logging.info(f"Checking face model for {user_email} at {FACE_SERVICE_URL}/check_model")
            face_response = requests.post(f'{FACE_SERVICE_URL}/check_model', 
                                       json={'username': user_email}, 
                                       timeout=5)
            face_response.raise_for_status()
            face_data = face_response.json()
            user_data['has_model'] = face_data.get('has_model', False)
            logging.info(f"Face service response: {face_data}")
            
            return render_template('face_auth.html', user_data=user_data)
            
        except Exception as e:
            logging.error(f"Error in face_auth: {str(e)}")
            flash('Unable to connect to services.', 'error')
            return redirect(url_for('login'))

    @flask_app.route('/update_face_auth', methods=['POST'])
    def update_face_auth():
        if 'user_id' not in session:
            return redirect(url_for('login'))
        
        user_email = session['user_id']
        enable_face_auth = request.form.get('enableFaceAuth') == 'on'
        
        try:
            # Call auth service API to update face auth settings
            response = requests.post(
                f'{AUTH_SERVICE_URL}/api/update-face-auth',
                json={'face_auth_enabled': enable_face_auth},
                headers={'X-User-Email': user_email}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    flash('Face authentication settings updated successfully', 'success')
                else:
                    flash(data.get('message', 'Failed to update face authentication settings'), 'error')
            else:
                flash('Failed to update face authentication settings', 'error')
                
            return redirect(url_for('face_auth'))
        except Exception as e:
            logging.error(f"Error updating face authentication: {str(e)}")
            flash('An error occurred while updating face authentication settings', 'error')
            return redirect(url_for('face_auth'))

    @flask_app.route('/delete_model', methods=['POST'])
    def delete_model():
        if 'user_id' not in session:
            return redirect(url_for('login'))
        
        user_email = session['user_id']
        try:
            response = requests.post(f'{FACE_SERVICE_URL}/delete_model', json={'username': user_email})
            result = response.json()
            flash(result['message'], result['status'])
            return redirect(url_for('face_auth'))
        except Exception as e:
            logging.error(f"Error deleting face model for {user_email}: {str(e)}")
            flash('Error contacting face service.', 'error')
            return redirect(url_for('face_auth'))

    @flask_app.route('/register', methods=['GET', 'POST'])
    def register():
        if request.method == 'POST':
            username = request.form.get('username')
            if username:
                users.append(username)
                return jsonify({'status': 'success', 'message': 'Registration started'})
        return render_template('register.html')

    @flask_app.route('/upload_frames', methods=['POST'])
    def upload_frames():
        data = request.get_json()
        try:
            response = requests.post(f'{FACE_SERVICE_URL}/upload_frames', json=data)
            return jsonify(response.json()), response.status_code
        except Exception as e:
            logging.error(f"Error uploading frames: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Error contacting face service'}), 500

    @flask_app.route('/match_face', methods=['POST'])
    def match_face():
        data = request.get_json()
        try:
            response = requests.post(f'{FACE_SERVICE_URL}/match_face', json=data)
            result = response.json()
            if result.get('status') == 'success' and result.get('verified'):
                session['user_id'] = result['username']
                session.permanent = True
                return jsonify({
                    'status': 'success',
                    'verified': True,
                    'username': result['username'],
                    'redirect': url_for('dashboard')  # Redirect to dashboard
                }), response.status_code
            return jsonify(result), response.status_code
        except Exception as e:
            logging.error(f"Error matching face: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Error contacting face service'}), 500

    @flask_app.route('/shutdown', methods=['GET'])
    def shutdown():
        try:
            # Get the shutdown function from the environment
            shutdown_func = request.environ.get('werkzeug.server.shutdown')
            if shutdown_func is None:
                # If we're not running with Werkzeug server, use a different approach
                import os
                import signal
                os.kill(os.getpid(), signal.SIGTERM)
                return 'Server shutting down...'
            shutdown_func()
            return 'Server shutting down...'
        except Exception as e:
            print(f"Error during shutdown: {str(e)}")
            return 'Error during shutdown', 500

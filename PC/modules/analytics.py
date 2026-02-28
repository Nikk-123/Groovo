"""
Analytics tracking module for Groovo application.
Proxies analytics tracking requests to the auth service.
"""

from flask import session, jsonify, request
import requests
import logging

from modules.config import AUTH_SERVICE_URL


def register_analytics_routes(flask_app):
    """Register all analytics tracking proxy endpoints."""
    
    @flask_app.route('/api/track/play', methods=['POST'])
    def track_play():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
        try:
            user_email = session['user_id']
            data = request.json
            
            response = requests.post(
                f'{AUTH_SERVICE_URL}/api/track/play',
                json=data,
                headers={'X-User-Email': user_email},
                timeout=30  # Increased for slow background process
            )
            return jsonify(response.json()), response.status_code
        except Exception as e:
            logging.error(f"Error tracking play: {str(e)}")
            return jsonify({'success': False, 'message': str(e)}), 500

    @flask_app.route('/api/track/pause', methods=['POST'])
    def track_pause():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
        try:
            user_email = session['user_id']
            data = request.json
            
            response = requests.post(
                f'{AUTH_SERVICE_URL}/api/track/pause',
                json=data,
                headers={'X-User-Email': user_email},
                timeout=30  # Increased for slow background process
            )
            return jsonify(response.json()), response.status_code
        except Exception as e:
            logging.error(f"Error tracking pause: {str(e)}")
            return jsonify({'success': False, 'message': str(e)}), 500

    @flask_app.route('/api/track/complete', methods=['POST'])
    def track_complete():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
        try:
            user_email = session['user_id']
            data = request.json
            
            response = requests.post(
                f'{AUTH_SERVICE_URL}/api/track/complete',
                json=data,
                headers={'X-User-Email': user_email},
                timeout=30  # Increased for slow background process
            )
            return jsonify(response.json()), response.status_code
        except Exception as e:
            logging.error(f"Error tracking complete: {str(e)}")
            return jsonify({'success': False, 'message': str(e)}), 500

    @flask_app.route('/api/track/skip', methods=['POST'])
    def track_skip():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
        try:
            user_email = session['user_id']
            data = request.json
            
            response = requests.post(
                f'{AUTH_SERVICE_URL}/api/track/skip',
                json=data,
                headers={'X-User-Email': user_email},
                timeout=30  # Increased for slow background process
            )
            return jsonify(response.json()), response.status_code
        except Exception as e:
            logging.error(f"Error tracking skip: {str(e)}")
            return jsonify({'success': False, 'message': str(e)}), 500

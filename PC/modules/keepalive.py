"""
Keep-alive system module for Groovo application.
Adaptive keep-alive system that adjusts ping frequency based on active user count.
"""

from flask import session, jsonify, request
import time
import logging

# Active user tracking for adaptive keep-alive system
ACTIVE_USERS = {}  # {user_email_or_client_id: last_seen_timestamp}
ACTIVE_USER_TIMEOUT = 900  # 15 minutes in seconds
TARGET_PINGS_PER_HOUR = 8  # Target total pings per hour across all users
MIN_INTERVAL_MINUTES = 5  # Minimum interval per user
MAX_INTERVAL_MINUTES = 120  # Maximum interval per user (2 hours)


def cleanup_stale_users(current_time):
    """Remove users who haven't been seen in ACTIVE_USER_TIMEOUT seconds"""
    stale_users = [
        user for user, last_seen in ACTIVE_USERS.items()
        if current_time - last_seen > ACTIVE_USER_TIMEOUT
    ]
    for user in stale_users:
        del ACTIVE_USERS[user]
        logging.debug(f"Removed stale user from keep-alive tracking: {user}")


def register_keepalive_routes(flask_app):
    """Register all keep-alive related routes."""
    
    @flask_app.route('/api/keepalive/ping', methods=['POST'])
    def keepalive_ping():
        """
        Smart keep-alive endpoint that:
        1. Registers user as active
        2. Calculates optimal interval based on active user count
        3. Returns recommended interval to client
        
        Formula: interval = (60 min / target_pings) * active_users
        This ensures total pings/hour stays constant regardless of user count
        """
        try:
            # Get user identifier (session email or client ID)
            user_id = session.get('user_id')
            if not user_id:
                # For non-logged-in or anonymous tracking
                data = request.get_json() or {}
                user_id = data.get('client_id', f'anonymous_{request.remote_addr}')
            
            current_time = time.time()
            
            # Update user's last seen time
            ACTIVE_USERS[user_id] = current_time
            
            # Clean up stale users
            cleanup_stale_users(current_time)
            
            # Calculate active user count
            active_count = len(ACTIVE_USERS)
            
            # Calculate recommended interval per user
            # Formula: (60 minutes / target_pings_per_hour) * active_users
            interval_minutes = (60 / TARGET_PINGS_PER_HOUR) * active_count
            
            # Apply bounds to prevent extreme values
            interval_minutes = max(MIN_INTERVAL_MINUTES, min(MAX_INTERVAL_MINUTES, interval_minutes))
            
            # Convert to milliseconds for JavaScript
            interval_ms = int(interval_minutes * 60 * 1000)
            
            logging.info(f"Keep-alive: {active_count} active users, interval: {interval_minutes:.1f}min")
            
            return jsonify({
                'status': 'ok',
                'timestamp': current_time,
                'active_users': active_count,
                'recommended_interval_ms': interval_ms,
                'recommended_interval_min': round(interval_minutes, 1),
                'target_pings_per_hour': TARGET_PINGS_PER_HOUR
            })
        except Exception as e:
            logging.error(f"Error in keepalive_ping: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': str(e),
                'recommended_interval_ms': 600000  # Fallback to 10 minutes
            }), 500

    @flask_app.route('/api/health-check', methods=['GET'])
    def health_check():
        """Simple health check endpoint (fallback/legacy)"""
        return jsonify({
            'status': 'ok',
            'timestamp': time.time()
        })

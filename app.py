"""
Groovo - Music Streaming Application
Main entry point that initializes the Flask app and webview.
"""

import webview
import os
import sys

# Import Flask app from modules
from modules.config import app

# Import route registration functions
from modules.auth import register_auth_routes
from modules.library import register_library_routes
from modules.player import register_player_routes
from modules.analytics import register_analytics_routes
from modules.keepalive import register_keepalive_routes
from modules.face_auth import register_face_auth_routes, users


# Register all routes
register_auth_routes(app)
register_library_routes(app)
register_player_routes(app)
register_analytics_routes(app)
register_keepalive_routes(app)
register_face_auth_routes(app)


if __name__ == "__main__":
    # Start Flask in a separate thread
    from threading import Thread
    flask_thread = Thread(target=lambda: app.run(debug=True, use_reloader=False, port=8000))
    flask_thread.daemon = True
    flask_thread.start()
    
    # Create and start webview window
    if getattr(sys, 'frozen', False):
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
    icon_path = os.path.join(base_dir, 'static', 'icon_new.png')
    
    # Note: 'icon' parameter removed as it causes TypeError in current environment
    window = webview.create_window("Groovo", "http://127.0.0.1:8000/")
    
    def cleanup():
        try:
            # Stop Flask server
            import requests
            try:
                requests.get('http://127.0.0.1:8000/shutdown', timeout=1)
            except:
                pass  # Ignore any connection errors during shutdown
            
            # Clear any in-memory data
            users.clear()
            
            # Force exit the application
            import sys
            sys.exit(0)
            
        except Exception as e:
            print(f"Error during cleanup: {str(e)}")
            # Force exit even if there's an error
            import sys
            sys.exit(1)
    
    # Register cleanup function
    window.events.closed += cleanup
    
    # Ensure storage path is writable and persistent
    storage_path = os.path.join(os.path.expanduser('~'), '.groovo', 'webview')
    try:
        os.makedirs(storage_path, exist_ok=True)
    except Exception as e:
        print(f"Failed to create storage directory: {e}")
        storage_path = None  # Fallback to default (temp) if creation fails

    # Start webview
    webview.start(private_mode=False, storage_path=storage_path)
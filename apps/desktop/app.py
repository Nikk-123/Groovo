"""
Groovo - Music Streaming Application
Main entry point that initializes the Flask app and webview.
"""

import webview
import os
import sys
from flask import request

# Import Flask app from modules
from modules.config import app

# Import route registration functions
from modules.auth import register_auth_routes
from modules.library import register_library_routes
from modules.player import register_player_routes
from modules.analytics import register_analytics_routes
from modules.keepalive import register_keepalive_routes


# Register all routes
register_auth_routes(app)
register_library_routes(app)
register_player_routes(app)
register_analytics_routes(app)
register_keepalive_routes(app)


@app.route('/shutdown', methods=['GET', 'POST'])
def shutdown():
    """Graceful shutdown endpoint — called by the webview close handler."""
    func = request.environ.get('werkzeug.server.shutdown')
    if func:
        func()
    # werkzeug.server.shutdown is unavailable in newer Werkzeug;
    # force-exit the process after a short delay so the response
    # can still be sent before the process dies.
    import threading, os
    threading.Timer(0.25, lambda: os._exit(0)).start()
    return 'Server shutting down...'


if __name__ == "__main__":
    # ── Single-instance guard ──────────────────────────────────
    import socket
    def is_already_running(port=8000):
        """Check if another Groovo instance is already using the port."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind(('127.0.0.1', port))
            sock.close()
            return False  # Port is free – no other instance
        except OSError:
            sock.close()
            return True   # Port in use – another instance is running

    if is_already_running():
        # Try to bring the existing window to the front via a simple request
        try:
            import requests as req
            req.get('http://127.0.0.1:8000/', timeout=2)
        except Exception:
            pass
        import ctypes
        ctypes.windll.user32.MessageBoxW(
            0,
            "Groovo is already running.\nCheck your taskbar for the existing window.",
            "Groovo",
            0x40  # MB_ICONINFORMATION
        )
        sys.exit(0)

    # Start Flask in a separate thread
    from threading import Thread
    flask_thread = Thread(target=lambda: app.run(debug=False, use_reloader=False, port=8000))
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
            import requests as req
            req.get('http://127.0.0.1:8000/shutdown', timeout=2)
        except Exception:
            pass  # Process will exit via os._exit in the /shutdown handler
        import os
        os._exit(0)
    
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
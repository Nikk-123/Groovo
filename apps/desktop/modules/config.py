"""
Configuration module for Groovo application.
Contains Flask app initialization, configuration, and constants.
"""

import os
import sys
from datetime import timedelta
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
import logging


# Set App User Model ID (AUMID) — Windows only
if os.name == 'nt':
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('Groovo.App.v1')
    except Exception as e:
        logging.error(f"Failed to set AUMID: {e}")

# Load environment variables
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    load_dotenv(os.path.join(bundle_dir, '.env'))
else:
    load_dotenv()

FACE_SERVICE_URL = os.getenv('FACE_SERVICE_URL', '#')
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'https://login-auth-jgxb.onrender.com')

# Get the project root directory (parent of modules/)
if getattr(sys, 'frozen', False):
    PROJECT_ROOT = sys._MEIPASS
else:
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Flask app setup with explicit template and static paths
app = Flask(
    __name__,
    template_folder=os.path.join(PROJECT_ROOT, 'templates'),
    static_folder=os.path.join(PROJECT_ROOT, 'static')
)

# Restrict CORS to localhost only — Groovo is a desktop webview app,
# so there is never a legitimate cross-origin caller from outside.
CORS(app, resources={r"/*": {"origins": [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]}})

# ── Secret key ────────────────────────────────────────────────
# Always load from the environment. Set FLASK_SECRET_KEY in your .env file.
# Example: FLASK_SECRET_KEY=some-long-random-string
_secret = os.getenv('FLASK_SECRET_KEY')
if not _secret:
    logging.warning(
        "FLASK_SECRET_KEY is not set in the environment. "
        "Using an insecure default. Add it to your .env file!"
    )
    _secret = 'dev-insecure-fallback-do-not-use-in-production'
app.secret_key = _secret
# ──────────────────────────────────────────────────────────────

app.permanent_session_lifetime = timedelta(days=30)
app.config['JSON_SORT_KEYS'] = False  # Preserve order of JSON responses

# Mood definitions
MOODS = [
    'Happy', 'Chill', 'Workout', 'Focus', 'Party',
    'Bollywood Party', 'Classical', 'Bhakti', 'Romantic', 'Punjabi'
]

# Configure logging
logging.basicConfig(level=logging.INFO)
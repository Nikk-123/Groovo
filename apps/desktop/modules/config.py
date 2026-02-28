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
import ctypes


# Set App User Model ID (AUMID) for Windows
# This ensures the app has a distinct identity in the taskbar and notifications
try:
    myappid = 'Groovo.App.v1'  # arbitrary string
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
except Exception as e:
    logging.error(f"Failed to set AUMID: {e}")

# Load environment variables
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    load_dotenv(os.path.join(bundle_dir, '.env'))
else:
    load_dotenv()

# Add face service URL (set via environment variable)
FACE_SERVICE_URL = os.getenv('FACE_SERVICE_URL', '#')
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://192.168.0.112:9000')

# Get the project root directory (parent of modules/)
# This ensures templates and static folders are found correctly
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    PROJECT_ROOT = sys._MEIPASS
else:
    # Running as script - go up one level from modules/ to project root
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Flask app setup with explicit template and static paths
app = Flask(
    __name__,
    template_folder=os.path.join(PROJECT_ROOT, 'templates'),
    static_folder=os.path.join(PROJECT_ROOT, 'static')
)
CORS(app, resources={r"/*": {"origins": "*"}})
app.secret_key = 'Chayan@12'
app.permanent_session_lifetime = timedelta(days=30)
app.config['JSON_SORT_KEYS'] = False  # Preserve order of JSON responses

# Mood definitions
MOODS = [
    'Happy', 'Chill', 'Workout', 'Focus', 'Party', 
    'Bollywood Party', 'Classical', 'Bhakti', 'Romantic', 'Punjabi'
]

# Configure logging
logging.basicConfig(level=logging.INFO)

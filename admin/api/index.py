"""
Vercel serverless function wrapper for Flask admin panel
Since 'admin' is set as the root directory in Vercel, we can directly import the app
"""
from admin_app import app

# This is the entry point for Vercel (exports the Flask app)
# The 'app' variable is what Vercel's Python runtime will use

"""
Vercel serverless function wrapper for Flask admin panel
This file adapts the Flask app to work with Vercel's serverless platform
"""
import sys
import os

# Add parent directory to path to import admin_app
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from admin_app import app

# Vercel expects a variable named 'app' or a handler function
# Since we're using Flask, we export the app directly
# Vercel's Python runtime will handle the WSGI interface

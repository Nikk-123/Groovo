"""
Vercel serverless function wrapper for Flask admin panel
Since Vercel is building from the root, we must add the 'apps/admin' path to sys.path
"""
import os
import sys

# Add the apps/admin directory to the Python path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__))))

from admin_app import app

# This is the entry point for Vercel (exports the Flask app)
# The 'app' variable is what Vercel's Python runtime will use

"""
Vercel serverless function wrapper for Flask admin panel
This file adapts the Flask app to work with Vercel's serverless platform
"""
import sys
import os

# Add the parent directory (admin folder) to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# Set the working directory to the admin folder to find templates and static files
os.chdir(parent_dir)

# Now import the Flask app
from admin_app import app

# This is the entry point for Vercel
# Vercel's Python runtime will call this app for each request

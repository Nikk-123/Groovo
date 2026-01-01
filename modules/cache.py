"""
Cache management module for Groovo application.
Handles library caching to improve performance and reduce API calls.
"""

import os
import json
import logging


# Simple in-memory cache for library
# Structure: { user_email: { 'data': [songs], 'timestamp': time.time() } }
CACHE_DIR = os.path.join(os.path.expanduser('~'), '.groovo')
CACHE_FILE = os.path.join(CACHE_DIR, 'library_cache.json')


def load_cache():
    """Load cache from disk."""
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logging.error(f"Failed to load cache: {e}")
    return {}


def save_cache():
    """Save cache to disk."""
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(CACHE_FILE, 'w') as f:
            json.dump(LIBRARY_CACHE, f)
    except Exception as e:
        logging.error(f"Failed to save cache: {e}")


LIBRARY_CACHE = load_cache()
CACHE_DURATION = 1800  # 30 minutes (increased to reduce slow external API calls)

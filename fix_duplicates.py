import os
import json
import requests
import time
from collections import defaultdict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'https://login-auth-jgxb.onrender.com')

# Cache configuration
CACHE_DIR = os.path.join(os.path.expanduser('~'), '.groovo')
CACHE_FILE = os.path.join(CACHE_DIR, 'library_cache.json')

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_cache(cache_data):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache_data, f)

def get_remote_library(user_email):
    """Fetch the current library from the server."""
    try:
        response = requests.get(
            f'{AUTH_SERVICE_URL}/api/check-session',
            headers={'X-User-Email': user_email},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return data.get('library', [])
    except Exception as e:
        print(f"Error fetching remote library: {e}")
    return None

def remove_from_server(user_email, song_data):
    """Remove a song from the server."""
    try:
        # Whitelist keys as per modules/library.py
        allowed_keys = {'url', 'title', 'artist', 'thumbnail', 'duration', 'channel', 'album'}
        payload = {k: song_data[k] for k in allowed_keys if k in song_data}
        
        response = requests.post(
            f'{AUTH_SERVICE_URL}/library/remove',
            json=payload,
            headers={'X-User-Email': user_email},
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        print(f"Error removing song: {e}")
        return False

def add_to_server(user_email, song_data):
    """Add a song to the server."""
    try:
        response = requests.post(
            f'{AUTH_SERVICE_URL}/library/add',
            json=song_data,
            headers={'X-User-Email': user_email},
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        print(f"Error adding song: {e}")
        return False

def main():
    print("Starting deduplication process...")
    cache = load_cache()
    
    if not cache:
        print("No local cache found.")
        return

    # Process each user in the cache
    for user_email, user_data in cache.items():
        print(f"\nProcessing user: {user_email}")
        
        if 'data' not in user_data:
            continue
            
        songs = user_data['data']
        print(f"Total songs in local cache: {len(songs)}")
        
        # Group by URL
        grouped_songs = defaultdict(list)
        for song in songs:
            url = song.get('url')
            if url:
                grouped_songs[url].append(song)
        
        duplicates_found = 0
        cleaned_library = []
        
        for url, instances in grouped_songs.items():
            # Always keep at least one instance locally
            master_copy = instances[0]
            cleaned_library.append(master_copy)
            
            count = len(instances)
            if count > 1:
                duplicates_found += (count - 1)
                print(f"Found {count} copies of: {master_copy.get('title', 'Unknown Title')}")
                
                # Logic to clean up server
                # We need to ensure the server has exactly 1 copy.
                
                # 1. Check server state first
                print(f"  Verifying server state for this song...")
                current_remote_lib = get_remote_library(user_email)
                
                if current_remote_lib is not None:
                    remote_instances = [s for s in current_remote_lib if s.get('url') == url]
                    remote_count = len(remote_instances)
                    print(f"  Server has {remote_count} copies.")
                    
                    if remote_count > 1:
                        # Remove excess copies
                        excess = remote_count - 1
                        print(f"  Removing {excess} excess copies from server...")
                        
                        for i in range(excess):
                            success = remove_from_server(user_email, master_copy)
                            if success:
                                print(f"    Removed copy {i+1}/{excess}")
                            else:
                                print(f"    Failed to remove copy {i+1}")
                            time.sleep(0.5) # Be nice to the API
                            
                        # Double check
                        new_remote_lib = get_remote_library(user_email)
                        new_remote_count = len([s for s in new_remote_lib if s.get('url') == url]) if new_remote_lib else 0
                        print(f"  Server now has {new_remote_count} copies.")
                        
                        if new_remote_count == 0:
                            print("  WARNING: Server removed all copies! Adding one back...")
                            add_to_server(user_email, master_copy)
                            
                    elif remote_count == 0:
                        print("  Server has 0 copies. Adding one back...")
                        add_to_server(user_email, master_copy)
                    else:
                        print("  Server already has exactly 1 copy. No action needed on server.")
                else:
                    print("  Could not fetch remote library. Skipping server sync for this song.")

        # Update local cache with the cleaned list
        user_data['data'] = cleaned_library
        print(f"Local cache updated. Removed {duplicates_found} duplicates locally.")
        
    save_cache(cache)
    print("\nProcess completed. Cache saved.")

if __name__ == "__main__":
    main()

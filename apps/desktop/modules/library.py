"""
Library management module for Groovo application.
Handles adding, removing, and retrieving user library with caching.
"""

from flask import session, jsonify, request
import requests
import logging

from modules.config import AUTH_SERVICE_URL
from modules.cache import LIBRARY_CACHE, save_cache, load_cache, CACHE_DURATION


def register_library_routes(flask_app):
    """Register all library management routes."""
    
    @flask_app.route('/library/add', methods=['POST'])
    def add_to_library():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
        try:
            song_data = request.json
            user_email = session['user_id']
            
            # Optimistic update: Update cache immediately
            if user_email in LIBRARY_CACHE:
                # Add timestamp if missing
                if 'dateAdded' not in song_data:
                    from datetime import datetime
                    song_data['dateAdded'] = datetime.now().isoformat()
                
                # Check for duplicates before appending
                current_lib = LIBRARY_CACHE[user_email]['data']
                if not any(s.get('url') == song_data.get('url') for s in current_lib):
                    current_lib.append(song_data)
                    save_cache()
                    logging.info(f"Optimistically added to cache for {user_email}")
            
            # Try to sync with server in background (non-blocking)
            try:
                response = requests.post(f'{AUTH_SERVICE_URL}/library/add',
                                      json=song_data,
                                      headers={'X-User-Email': user_email},
                                      timeout=10)
                
                if response.status_code == 200 and response.json().get('success'):
                    logging.info(f"Successfully synced add to server for {user_email}")
                return jsonify(response.json()), response.status_code
            except requests.Timeout:
                logging.warning(f"Timeout adding to library for {user_email}, but cache updated")
                # Return success anyway since cache is updated
                return jsonify({
                    'success': True,
                    'message': 'Added to library (sync pending)'
                }), 200
            except requests.RequestException as e:
                logging.error(f"Error syncing add to server for {user_email}: {str(e)}")
                # Return success anyway since cache is updated
                return jsonify({
                    'success': True,
                    'message': 'Added to library (sync pending)'
                }), 200
                
        except Exception as e:
            logging.error(f"Error adding to library: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'An error occurred while adding to library'
            }), 500

    @flask_app.route('/library/remove', methods=['POST'])
    def remove_from_library():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
        try:
            song_data = request.json
            user_email = session['user_id']
            
            # Optimistic update: Update cache immediately
            if user_email in LIBRARY_CACHE:
                target_url = song_data.get('url')
                LIBRARY_CACHE[user_email]['data'] = [
                    s for s in LIBRARY_CACHE[user_email]['data'] 
                    if s.get('url') != target_url
                ]
                save_cache()
                logging.info(f"Optimistically removed from cache for {user_email}")
            
            # Try to sync with server in background (non-blocking)
            try:
                # Sanitize data: WHITELIST only essential fields 
                # The backend likely stores a subset of fields. Sending extra fields (like 'views', 'dateAdded')
                # causes strict matching to fail (404 Song not found).
                allowed_keys = {'url', 'title', 'artist', 'thumbnail', 'duration', 'channel', 'album'}
                payload = {k: song_data[k] for k in allowed_keys if k in song_data}
                
                logging.info(f"Syncing remove for {user_email} with payload keys: {list(payload.keys())}")
                
                response = requests.post(f'{AUTH_SERVICE_URL}/library/remove',
                                      json=payload,
                                      headers={'X-User-Email': user_email},
                                      timeout=10)
                
                if response.status_code == 200 and response.json().get('success'):
                    logging.info(f"Successfully synced remove to server for {user_email}")
                elif response.status_code == 404:
                    # Treat 404 as success (item already gone or desync)
                    logging.warning(f"Song not found on server (404), removing from local cache only for {user_email}")
                    return jsonify({'success': True, 'message': 'Removed (was not on server)'}), 200
                else:
                    logging.warning(f"Failed to sync remove. Status: {response.status_code}, Body: {response.text}")
                    
                return jsonify(response.json()), response.status_code
            except requests.Timeout:
                logging.warning(f"Timeout removing from library for {user_email}, but cache updated")
                # Return success anyway since cache is updated
                return jsonify({
                    'success': True,
                    'message': 'Removed from library (sync pending)'
                }), 200
            except requests.RequestException as e:
                logging.error(f"Error syncing remove to server for {user_email}: {str(e)}")
                # Return success anyway since cache is updated
                return jsonify({
                    'success': True,
                    'message': 'Removed from library (sync pending)'
                }), 200
                
        except Exception as e:
            logging.error(f"Error removing from library: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'An error occurred'
            }), 500

    @flask_app.route('/library/get', methods=['GET'])
    def get_library():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
        try:
            user_email = session['user_id']
            force_refresh = request.args.get('force') == '1'
            import time
            from threading import Thread
            
            # Reload cache from disk to handle Flask debug mode reloads
            # NOTE: Must mutate in-place (not rebind) so cache.py's save_cache()
            # and other modules still reference the same dict object.
            disk_cache = load_cache()
            if disk_cache:
                LIBRARY_CACHE.clear()
                LIBRARY_CACHE.update(disk_cache)
            
            # Optional: force refresh from auth service
            if force_refresh:
                try:
                    logging.info(f"Force refresh requested for {user_email}")
                    response = requests.get(
                        f'{AUTH_SERVICE_URL}/api/check-session',
                        headers={'X-User-Email': user_email},
                        # Render free-tier can take 30-50s to wake from cold start;
                        # 45s gives it a fair chance before we fall back to cache.
                        timeout=45
                    )
                    response.raise_for_status()
                    data = response.json()

                    if data.get('success'):
                        library_data = data.get('library', [])
                        LIBRARY_CACHE[user_email] = {
                            'data': library_data,
                            'timestamp': time.time()
                        }
                        save_cache()
                        return jsonify({
                            'success': True,
                            'library': library_data,
                            'syncing': False
                        })
                except Exception as e:
                    logging.warning(f"Force refresh failed for {user_email}: {str(e)}")

            # Get cached data
            cached = LIBRARY_CACHE.get(user_email)
            
            # Define background sync function
            def sync_library_in_background():
                """Sync library with auth service in background"""
                try:
                    logging.info(f"Background sync started for {user_email}")
                    response = requests.get(
                        f'{AUTH_SERVICE_URL}/api/check-session',
                        headers={'X-User-Email': user_email},
                        timeout=60  # Longer timeout for background sync (non-blocking)
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    if data.get('success'):
                        library_data = data.get('library', [])
                        # Update cache silently
                        LIBRARY_CACHE[user_email] = {
                            'data': library_data,
                            'timestamp': time.time()
                        }
                        save_cache()
                        logging.info(f"Background sync completed for {user_email}")
                except Exception as e:
                    logging.error(f"Background sync failed for {user_email}: {str(e)}")
            
            # Strategy: Always serve cache first if available, then sync in background
            if cached:
                # Serve cached data immediately
                logging.info(f"Serving library from cache for {user_email}")
                syncing = False
                
                # If cache is old (> 5 minutes), trigger background sync
                if time.time() - cached['timestamp'] > CACHE_DURATION:
                    logging.info(f"Cache is old, triggering background sync for {user_email}")
                    sync_thread = Thread(target=sync_library_in_background, daemon=True)
                    sync_thread.start()
                    syncing = True
                
                return jsonify({
                    'success': True,
                    'library': cached['data'],
                    'syncing': syncing
                })
            
            # No cache exists - must fetch synchronously (first time only)
            logging.info(f"No cache found for {user_email}, fetching from auth service...")
            try:
                response = requests.get(
                    f'{AUTH_SERVICE_URL}/api/check-session',
                    headers={'X-User-Email': user_email},
                    timeout=10
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get('success'):
                    library_data = data.get('library', [])
                    # Update cache
                    LIBRARY_CACHE[user_email] = {
                        'data': library_data,
                        'timestamp': time.time()
                    }
                    save_cache()
                    logging.info(f"Successfully fetched and cached library for {user_email}")
                    return jsonify({
                        'success': True,
                        'library': library_data
                    })
            except requests.Timeout:
                logging.warning(f"Timeout fetching library for {user_email}")
                return jsonify({
                    'success': False,
                    'message': 'Service timeout - please try again'
                }), 504
            except requests.RequestException as e:
                logging.error(f"Request error fetching library for {user_email}: {str(e)}")
                return jsonify({
                    'success': False,
                    'message': 'Failed to fetch library'
                }), 500

            # Fallback: auth service responded but success=False
            return jsonify({
                'success': False,
                'message': 'Auth service returned no library data'
            }), 502
        except Exception as e:
            logging.error(f"Unexpected error in get_library: {str(e)}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500
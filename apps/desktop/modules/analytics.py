"""
Analytics tracking module for Groovo application.
Proxies analytics tracking requests to the auth service.

All tracking calls are fire-and-forget: the endpoint returns 202 immediately
and the actual HTTP request to the auth service runs in a background thread.
This prevents a slow/offline auth service from blocking playback.
"""

from flask import session, jsonify, request
from threading import Thread
import requests
import logging

from modules.config import AUTH_SERVICE_URL


def _fire_and_forget(url: str, payload: dict, user_email: str, label: str):
    """Send a tracking POST in a background thread. Never raises."""
    def _send():
        try:
            requests.post(
                url,
                json=payload,
                headers={'X-User-Email': user_email},
                timeout=15,  # Reasonable cap; failure is silently logged
            )
            logging.debug(f"Analytics {label} sent for {user_email}")
        except Exception as e:
            logging.warning(f"Analytics {label} failed for {user_email}: {e}")

    Thread(target=_send, daemon=True).start()


def register_analytics_routes(flask_app):
    """Register all analytics tracking proxy endpoints."""

    @flask_app.route('/api/track/play', methods=['POST'])
    def track_play():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        _fire_and_forget(
            f'{AUTH_SERVICE_URL}/api/track/play',
            request.json or {},
            session['user_id'],
            'play',
        )
        return jsonify({'success': True}), 202

    @flask_app.route('/api/track/pause', methods=['POST'])
    def track_pause():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        _fire_and_forget(
            f'{AUTH_SERVICE_URL}/api/track/pause',
            request.json or {},
            session['user_id'],
            'pause',
        )
        return jsonify({'success': True}), 202

    @flask_app.route('/api/track/complete', methods=['POST'])
    def track_complete():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        _fire_and_forget(
            f'{AUTH_SERVICE_URL}/api/track/complete',
            request.json or {},
            session['user_id'],
            'complete',
        )
        return jsonify({'success': True}), 202

    @flask_app.route('/api/track/skip', methods=['POST'])
    def track_skip():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Not logged in'}), 401
        _fire_and_forget(
            f'{AUTH_SERVICE_URL}/api/track/skip',
            request.json or {},
            session['user_id'],
            'skip',
        )
        return jsonify({'success': True}), 202
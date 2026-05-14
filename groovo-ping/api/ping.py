"""
Vercel serverless function — Render keep-alive ping.

Deployed at: GET /api/ping
Triggered by: Vercel cron (every 14 minutes, see vercel.json)

Purpose:
  Render's free tier spins down instances after 15 minutes of inactivity.
  This function hits the auth service's /api/health endpoint before that
  window closes, keeping the dyno warm.

Environment variable required (set in Vercel project settings):
  AUTH_SERVICE_URL  — e.g. https://login-auth-jgxb.onrender.com
"""

from http.server import BaseHTTPRequestHandler
import urllib.request
import urllib.error
import json
import os
import logging

AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', '').rstrip('/')


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        result = _ping_auth_service()
        status_code = 200 if result['ok'] else 502

        body = json.dumps(result).encode()
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # Silence the default request log line that BaseHTTPRequestHandler prints
    # to stdout — Vercel captures stderr for function logs.
    def log_message(self, fmt, *args):
        pass


def _ping_auth_service() -> dict:
    """
    Call GET /api/health on the Render auth service.
    Returns a dict with keys: ok, status, db, message.
    """
    if not AUTH_SERVICE_URL:
        logging.error("[ping] AUTH_SERVICE_URL is not set")
        return {
            'ok':      False,
            'status':  'misconfigured',
            'db':      'unknown',
            'message': 'AUTH_SERVICE_URL environment variable is not set',
        }

    url = f"{AUTH_SERVICE_URL}/api/health"

    try:
        req = urllib.request.Request(url, method='GET')
        # Give Render up to 30 s to respond (cold-start can be slow)
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            data = json.loads(raw)
            logging.info(f"[ping] {url} → {resp.status} {data}")
            return {
                'ok':      data.get('success', False),
                'status':  data.get('status', 'unknown'),
                'db':      data.get('db', 'unknown'),
                'message': f"Auth service responded with HTTP {resp.status}",
            }

    except urllib.error.HTTPError as e:
        logging.error(f"[ping] HTTP error {e.code} from {url}")
        return {
            'ok':      False,
            'status':  'unhealthy',
            'db':      'unknown',
            'message': f"Auth service returned HTTP {e.code}",
        }

    except urllib.error.URLError as e:
        logging.error(f"[ping] URLError reaching {url}: {e.reason}")
        return {
            'ok':      False,
            'status':  'unreachable',
            'db':      'unknown',
            'message': f"Could not reach auth service: {e.reason}",
        }

    except Exception as e:
        logging.exception(f"[ping] Unexpected error pinging {url}")
        return {
            'ok':      False,
            'status':  'error',
            'db':      'unknown',
            'message': str(e),
        }
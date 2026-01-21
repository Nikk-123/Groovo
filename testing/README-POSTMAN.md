# Groovo API - Postman Collection Generator

This project includes a JavaScript-based tool to programmatically generate a complete Postman collection for testing all Groovo API endpoints.

## 📋 Overview

The generator creates a comprehensive Postman collection with **29 endpoints** organized into 6 logical folders:

- **Authentication** (8 endpoints) - Login, signup, session management
- **Library Management** (3 endpoints) - Add, remove, retrieve songs
- **Player & Playback** (4 endpoints) - Play, search, trending, playlists
- **Analytics Tracking** (4 endpoints) - Track play, pause, complete, skip events
- **Keep-Alive & Health** (2 endpoints) - Health checks and adaptive keep-alive
- **Face Authentication** (8 endpoints) - Face recognition and biometric auth

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **Postman** desktop app - [Download here](https://www.postman.com/downloads/)
- Groovo Flask application running on `http://127.0.0.1:8000`

### Installation

1. **Navigate to the Groovo project directory:**
   ```bash
   cd c:\Users\chaya\OneDrive\Desktop\PERSONAL\TEST\Groovo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Generate Collection

Run the generator script:
```bash
node generate-postman-collection.js
```

Or use the npm script:
```bash
npm run generate
```

This will create `groovo-collection.json` in the current directory.

## 📥 Import into Postman

1. **Open Postman** desktop application
2. Click **Import** button (top-left corner)
3. Select **files** tab
4. Choose `groovo-collection.json`
5. Click **Import**

Your collection will appear in the Collections sidebar with all 29 endpoints organized in folders.

## ⚙️ Setup Environment

To avoid hardcoding the base URL, set up a Postman environment:

1. Click **Environments** (left sidebar)
2. Click **+** to create new environment
3. Name it "Groovo Local"
4. Add variable:
   - **Variable:** `base_url`
   - **Initial Value:** `http://127.0.0.1:8000`
   - **Current Value:** `http://127.0.0.1:8000`
5. Click **Save**
6. Select "Groovo Local" from environment dropdown (top-right)

Now all requests will use `{{base_url}}` which can be easily changed for different environments (local, staging, production).

## 🧪 Testing the APIs

### 1. Start Your Flask Application

Make sure your Groovo application is running:
```bash
python app.py
```

### 2. Test Workflow

**Step 1: Health Check (No Auth Required)**
- Navigate to: `Keep-Alive & Health` → `Health Check`
- Click **Send**
- Should return: `{ "status": "ok", "timestamp": ... }`

**Step 2: Create Account**
- Navigate to: `Authentication` → `Signup`
- Modify body with your email/password
- Click **Send**
- Should redirect to login

**Step 3: Login**
- Navigate to: `Authentication` → `Login`
- Use the same credentials from signup
- Click **Send**
- Session cookie will be automatically saved

**Step 4: Check Session**
- Navigate to: `Authentication` → `Check Session`
- Click **Send**
- Should return user data and library

**Step 5: Search for Songs**
- Navigate to: `Player & Playback` → `Search Songs`
- Modify query parameter (e.g., "neffex", "relax music")
- Click **Send**
- Returns up to 25 search results

**Step 6: Play a Song**
- Navigate to: `Player & Playback` → `Play Song (Get Audio URL)`
- Copy a URL from search results
- Paste into request body
- Click **Send**
- Returns audio stream URL and metadata

**Step 7: Add to Library**
- Navigate to: `Library Management` → `Add to Library`
- Use song data from previous step
- Click **Send**
- Song added to your library

**Step 8: Get Library**
- Navigate to: `Library Management` → `Get Library`
- Click **Send**
- Returns all songs in your library

**Step 9: Track Analytics**
- Navigate to: `Analytics Tracking` → `Track Play Event`
- Click **Send**
- Event is logged for analytics

## 📚 Endpoint Reference

### Authentication Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/login` | POST | User login | No |
| `/signup` | POST | User registration | No |
| `/logout` | GET | Logout current user | Yes |
| `/check-session` | GET | Validate session | Yes |
| `/` | GET | Root redirect | No |
| `/dashboard` | GET | Dashboard page | Yes |
| `/settings` | GET | Settings page | Yes |
| `/edit_profile` | POST | Update profile | Yes |

### Library Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/library/add` | POST | Add song to library | Yes |
| `/library/remove` | POST | Remove from library | Yes |
| `/library/get` | GET | Get user library | Yes |

### Player Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/play` | POST | Get audio URL | No |
| `/search` | GET | Search songs | No |
| `/api/trending` | GET | Get trending songs | No |
| `/api/playlist` | GET | Get mood playlist | No |

### Analytics Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/track/play` | POST | Track play event | Yes |
| `/api/track/pause` | POST | Track pause event | Yes |
| `/api/track/complete` | POST | Track completion | Yes |
| `/api/track/skip` | POST | Track skip event | Yes |

### Keep-Alive Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/keepalive/ping` | POST | Adaptive keep-alive | No |
| `/api/health-check` | GET | Health check | No |

### Face Authentication Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/face_auth` | GET | Face auth page | Yes |
| `/update_face_auth` | POST | Update settings | Yes |
| `/delete_model` | POST | Delete face model | Yes |
| `/register` | GET/POST | Register for face auth | Varies |
| `/upload_frames` | POST | Upload face frames | No |
| `/match_face` | POST | Match face login | No |
| `/shutdown` | GET | Shutdown server | No |

## 🔧 Customization

To modify the collection, edit `generate-postman-collection.js` and re-run the generator.

**Example: Add a new endpoint**
```javascript
myFolder.items.add(new sdk.Item({
    name: 'My New Endpoint',
    request: {
        method: 'POST',
        url: '{{base_url}}/my-endpoint',
        header: [
            { key: 'Content-Type', value: 'application/json' }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({ key: 'value' }, null, 2)
        },
        description: 'Description of what this endpoint does'
    }
}));
```

Then regenerate:
```bash
npm run generate
```

## 💡 Tips & Best Practices

1. **Cookie-based Sessions:** Most endpoints require authentication. Postman automatically manages cookies after login.

2. **Environment Variables:** Use `{{base_url}}` for flexibility across environments.

3. **Collections Runner:** Use Postman's Collection Runner to test multiple endpoints sequentially.

4. **Pre-request Scripts:** Add scripts to generate dynamic data (timestamps, UUIDs, etc.).

5. **Tests Tab:** Add assertions to validate responses automatically.

6. **Export Updated Collection:** After customizing in Postman UI, export to save changes.

## 🐛 Troubleshooting

**Issue: `npm install` fails**
- Make sure Node.js is installed: `node --version`
- Try clearing npm cache: `npm cache clean --force`

**Issue: Collection not importing**
- Verify `groovo-collection.json` exists
- Check file is valid JSON (open in text editor)
- Try dragging file directly into Postman

**Issue: Endpoints returning 401**
- Make sure you've logged in first (`POST /login`)
- Check that cookies are enabled in Postman
- Verify session is valid with `GET /check-session`

**Issue: Endpoints timing out**
- Ensure Flask app is running: `python app.py`
- Verify base_url environment variable is correct
- Check firewall/antivirus isn't blocking localhost

## 📖 Additional Resources

- [Postman Collection SDK Documentation](https://www.postmanlabs.com/postman-collection/)
- [Postman Learning Center](https://learning.postman.com/)
- [Flask Documentation](https://flask.palletsprojects.com/)

## 📄 License

This collection generator is part of the Groovo project.

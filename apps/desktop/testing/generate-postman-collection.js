/**
 * Groovo API - Postman Collection Generator
 * 
 * This script generates a comprehensive Postman collection for all Groovo API endpoints.
 * It uses the Postman Collection SDK to programmatically create the collection.
 * 
 * Usage: node generate-postman-collection.js
 * Output: groovo-collection.json
 */

const fs = require('fs');
const sdk = require('postman-collection');

// Create a new collection
const collection = new sdk.Collection({
    info: {
        name: 'Groovo API Collection',
        description: 'Complete API collection for Groovo Music Streaming Application. Includes authentication, library management, player controls, analytics tracking, keep-alive, and face authentication endpoints.',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    variable: [
        {
            key: 'base_url',
            value: 'http://127.0.0.1:8000',
            type: 'string'
        }
    ]
});

// ===== AUTHENTICATION ROUTES =====
const authFolder = new sdk.ItemGroup({
    name: 'Authentication',
    description: 'User authentication and session management endpoints'
});

// POST /login
authFolder.items.add(new sdk.Item({
    name: 'Login',
    request: {
        method: 'POST',
        url: '{{base_url}}/login',
        header: [
            {
                key: 'Content-Type',
                value: 'application/x-www-form-urlencoded'
            }
        ],
        body: {
            mode: 'urlencoded',
            urlencoded: [
                { key: 'email', value: 'test@example.com', description: 'User email' },
                { key: 'password', value: 'password123', description: 'User password' }
            ]
        },
        description: 'User login with email and password. Returns session cookie on success.'
    }
}));

// POST /signup
authFolder.items.add(new sdk.Item({
    name: 'Signup',
    request: {
        method: 'POST',
        url: '{{base_url}}/signup',
        header: [
            {
                key: 'Content-Type',
                value: 'application/x-www-form-urlencoded'
            }
        ],
        body: {
            mode: 'urlencoded',
            urlencoded: [
                { key: 'email', value: 'newuser@example.com', description: 'User email' },
                { key: 'password', value: 'password123', description: 'User password' }
            ]
        },
        description: 'Register a new user account'
    }
}));

// GET /logout
authFolder.items.add(new sdk.Item({
    name: 'Logout',
    request: {
        method: 'GET',
        url: '{{base_url}}/logout',
        description: 'Logout current user and clear session'
    }
}));

// GET /check-session
authFolder.items.add(new sdk.Item({
    name: 'Check Session',
    request: {
        method: 'GET',
        url: '{{base_url}}/check-session',
        description: 'Validate current session and get user data with library'
    }
}));

// GET /
authFolder.items.add(new sdk.Item({
    name: 'Root (Index)',
    request: {
        method: 'GET',
        url: '{{base_url}}/',
        description: 'Root endpoint - redirects to login or dashboard based on session'
    }
}));

// GET /dashboard
authFolder.items.add(new sdk.Item({
    name: 'Dashboard',
    request: {
        method: 'GET',
        url: '{{base_url}}/dashboard',
        description: 'Access dashboard (requires authentication)'
    }
}));

// GET /settings
authFolder.items.add(new sdk.Item({
    name: 'Settings Page',
    request: {
        method: 'GET',
        url: '{{base_url}}/settings',
        description: 'Access settings page (requires authentication)'
    }
}));

// POST /edit_profile
authFolder.items.add(new sdk.Item({
    name: 'Edit Profile',
    request: {
        method: 'POST',
        url: '{{base_url}}/edit_profile',
        header: [
            {
                key: 'Content-Type',
                value: 'application/x-www-form-urlencoded'
            }
        ],
        body: {
            mode: 'urlencoded',
            urlencoded: [
                { key: 'username', value: 'NewUsername', description: 'New username' },
                { key: 'email', value: 'newemail@example.com', description: 'New email' }
            ]
        },
        description: 'Update user profile information (requires authentication)'
    }
}));

collection.items.add(authFolder);

// ===== LIBRARY ROUTES =====
const libraryFolder = new sdk.ItemGroup({
    name: 'Library Management',
    description: 'User library management - add, remove, and retrieve songs'
});

// POST /library/add
libraryFolder.items.add(new sdk.Item({
    name: 'Add to Library',
    request: {
        method: 'POST',
        url: '{{base_url}}/library/add',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                title: 'Sample Song',
                artist: 'Sample Artist',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                duration: '3:32'
            }, null, 2)
        },
        description: 'Add a song to user library (requires authentication)'
    }
}));

// POST /library/remove
libraryFolder.items.add(new sdk.Item({
    name: 'Remove from Library',
    request: {
        method: 'POST',
        url: '{{base_url}}/library/remove',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            }, null, 2)
        },
        description: 'Remove a song from user library (requires authentication)'
    }
}));

// GET /library/get
libraryFolder.items.add(new sdk.Item({
    name: 'Get Library',
    request: {
        method: 'GET',
        url: '{{base_url}}/library/get',
        description: 'Retrieve user library with all saved songs (requires authentication)'
    }
}));

collection.items.add(libraryFolder);

// ===== PLAYER ROUTES =====
const playerFolder = new sdk.ItemGroup({
    name: 'Player & Playback',
    description: 'Music playback, search, and playlist endpoints'
});

// POST /play
playerFolder.items.add(new sdk.Item({
    name: 'Play Song (Get Audio URL)',
    request: {
        method: 'POST',
        url: '{{base_url}}/play',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            }, null, 2)
        },
        description: 'Extract audio URL and metadata from a YouTube video URL'
    }
}));

// GET /search
playerFolder.items.add(new sdk.Item({
    name: 'Search Songs',
    request: {
        method: 'GET',
        url: {
            raw: '{{base_url}}/search?query=neffex',
            host: ['{{base_url}}'],
            path: ['search'],
            query: [
                { key: 'query', value: 'neffex', description: 'Search query string' }
            ]
        },
        description: 'Search for songs on YouTube (returns up to 25 results)'
    }
}));

// GET /api/trending
playerFolder.items.add(new sdk.Item({
    name: 'Get Trending Songs',
    request: {
        method: 'GET',
        url: '{{base_url}}/api/trending',
        description: 'Get current trending songs'
    }
}));

// GET /api/playlist
playerFolder.items.add(new sdk.Item({
    name: 'Get Mood Playlist',
    request: {
        method: 'GET',
        url: {
            raw: '{{base_url}}/api/playlist?mood=happy',
            host: ['{{base_url}}'],
            path: ['api', 'playlist'],
            query: [
                { key: 'mood', value: 'happy', description: 'Mood type (happy, sad, energetic, chill, romantic, workout)' }
            ]
        },
        description: 'Get playlist based on mood category'
    }
}));

collection.items.add(playerFolder);

// ===== ANALYTICS ROUTES =====
const analyticsFolder = new sdk.ItemGroup({
    name: 'Analytics Tracking',
    description: 'Track user playback events and listening analytics'
});

// POST /api/track/play
analyticsFolder.items.add(new sdk.Item({
    name: 'Track Play Event',
    request: {
        method: 'POST',
        url: '{{base_url}}/api/track/play',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                title: 'Sample Song',
                artist: 'Sample Artist',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                timestamp: new Date().toISOString()
            }, null, 2)
        },
        description: 'Track when a song starts playing (requires authentication)'
    }
}));

// POST /api/track/pause
analyticsFolder.items.add(new sdk.Item({
    name: 'Track Pause Event',
    request: {
        method: 'POST',
        url: '{{base_url}}/api/track/pause',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                title: 'Sample Song',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                timestamp: new Date().toISOString()
            }, null, 2)
        },
        description: 'Track when a song is paused (requires authentication)'
    }
}));

// POST /api/track/complete
analyticsFolder.items.add(new sdk.Item({
    name: 'Track Complete Event',
    request: {
        method: 'POST',
        url: '{{base_url}}/api/track/complete',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                title: 'Sample Song',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                timestamp: new Date().toISOString()
            }, null, 2)
        },
        description: 'Track when a song completes playing (requires authentication)'
    }
}));

// POST /api/track/skip
analyticsFolder.items.add(new sdk.Item({
    name: 'Track Skip Event',
    request: {
        method: 'POST',
        url: '{{base_url}}/api/track/skip',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                title: 'Sample Song',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                timestamp: new Date().toISOString()
            }, null, 2)
        },
        description: 'Track when a song is skipped (requires authentication)'
    }
}));

collection.items.add(analyticsFolder);

// ===== KEEP-ALIVE ROUTES =====
const keepaliveFolder = new sdk.ItemGroup({
    name: 'Keep-Alive & Health',
    description: 'Server health check and adaptive keep-alive system'
});

// POST /api/keepalive/ping
keepaliveFolder.items.add(new sdk.Item({
    name: 'Keep-Alive Ping',
    request: {
        method: 'POST',
        url: '{{base_url}}/api/keepalive/ping',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                client_id: 'test-client-123'
            }, null, 2)
        },
        description: 'Adaptive keep-alive ping that returns recommended interval based on active users'
    }
}));

// GET /api/health-check
keepaliveFolder.items.add(new sdk.Item({
    name: 'Health Check',
    request: {
        method: 'GET',
        url: '{{base_url}}/api/health-check',
        description: 'Simple server health check endpoint'
    }
}));

collection.items.add(keepaliveFolder);

// ===== FACE AUTHENTICATION ROUTES =====
const faceAuthFolder = new sdk.ItemGroup({
    name: 'Face Authentication',
    description: 'Face recognition and biometric authentication endpoints'
});

// GET /face_auth
faceAuthFolder.items.add(new sdk.Item({
    name: 'Face Auth Page',
    request: {
        method: 'GET',
        url: '{{base_url}}/face_auth',
        description: 'Access face authentication page (requires authentication)'
    }
}));

// POST /update_face_auth
faceAuthFolder.items.add(new sdk.Item({
    name: 'Update Face Auth Settings',
    request: {
        method: 'POST',
        url: '{{base_url}}/update_face_auth',
        header: [
            {
                key: 'Content-Type',
                value: 'application/x-www-form-urlencoded'
            }
        ],
        body: {
            mode: 'urlencoded',
            urlencoded: [
                { key: 'enableFaceAuth', value: 'on', description: 'Enable/disable face auth (on/off)' }
            ]
        },
        description: 'Enable or disable face authentication (requires authentication)'
    }
}));

// POST /delete_model
faceAuthFolder.items.add(new sdk.Item({
    name: 'Delete Face Model',
    request: {
        method: 'POST',
        url: '{{base_url}}/delete_model',
        description: 'Delete user face recognition model (requires authentication)'
    }
}));

// GET /register
faceAuthFolder.items.add(new sdk.Item({
    name: 'Register Page (GET)',
    request: {
        method: 'GET',
        url: '{{base_url}}/register',
        description: 'Access face registration page'
    }
}));

// POST /register
faceAuthFolder.items.add(new sdk.Item({
    name: 'Register User (POST)',
    request: {
        method: 'POST',
        url: '{{base_url}}/register',
        header: [
            {
                key: 'Content-Type',
                value: 'application/x-www-form-urlencoded'
            }
        ],
        body: {
            mode: 'urlencoded',
            urlencoded: [
                { key: 'username', value: 'testuser', description: 'Username for registration' }
            ]
        },
        description: 'Register user for face authentication'
    }
}));

// POST /upload_frames
faceAuthFolder.items.add(new sdk.Item({
    name: 'Upload Face Frames',
    request: {
        method: 'POST',
        url: '{{base_url}}/upload_frames',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                username: 'testuser',
                frames: ['base64_encoded_frame_1', 'base64_encoded_frame_2']
            }, null, 2)
        },
        description: 'Upload face frames for model training (proxied to face service)'
    }
}));

// POST /match_face
faceAuthFolder.items.add(new sdk.Item({
    name: 'Match Face for Login',
    request: {
        method: 'POST',
        url: '{{base_url}}/match_face',
        header: [
            {
                key: 'Content-Type',
                value: 'application/json'
            }
        ],
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                frame: 'base64_encoded_frame'
            }, null, 2)
        },
        description: 'Match face against stored models for authentication (proxied to face service)'
    }
}));

// GET /shutdown
faceAuthFolder.items.add(new sdk.Item({
    name: 'Shutdown Server',
    request: {
        method: 'GET',
        url: '{{base_url}}/shutdown',
        description: 'Shutdown the Flask server (admin function)'
    }
}));

collection.items.add(faceAuthFolder);

// Convert collection to JSON and save
const collectionJSON = collection.toJSON();
const outputPath = './groovo-collection.json';

fs.writeFileSync(outputPath, JSON.stringify(collectionJSON, null, 2));

console.log('✅ Postman collection generated successfully!');
console.log(`📁 File: ${outputPath}`);
console.log(`📊 Total endpoints: ${authFolder.items.count() +
    libraryFolder.items.count() +
    playerFolder.items.count() +
    analyticsFolder.items.count() +
    keepaliveFolder.items.count() +
    faceAuthFolder.items.count()
    }`);
console.log('\n📖 Next steps:');
console.log('   1. Import groovo-collection.json into Postman');
console.log('   2. Set up environment variable: base_url = http://127.0.0.1:8000');
console.log('   3. Start testing your APIs!');

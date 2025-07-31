# 🎵 GROOVO (Previously Known as Gareeb Ka Spotify)

A feature-rich music streaming application built with Flask and PyWebView that provides YouTube-based music streaming with advanced features like face authentication, mood-based playlists, and a modern web interface.

## 🌟 Features

### 🎶 Core Music Features
- **YouTube Music Streaming**: Stream music directly from YouTube with high-quality audio extraction
- **Search & Discovery**: Intelligent music search with auto-suggestions
- **Trending Music**: Real-time trending songs from YouTube
- **Mood-based Playlists**: Pre-curated playlists for different moods:
  - Happy & Upbeat
  - Chill & Lofi
  - Workout Motivation
  - Focus & Study
  - Party Hits
  - Bollywood Party
  - Classical Indian
  - Bhakti Songs
  - Romantic Bollywood
  - Latest Punjabi Hits

### 🎵 Music Player
- **Advanced Audio Controls**: Play, pause, skip, previous, shuffle, repeat
- **Volume Control**: Adjustable volume with visual feedback
- **Progress Tracking**: Real-time song progress with seek functionality
- **Queue Management**: Dynamic playlist queue with shuffle support
- **Mini Player**: Compact player view for multitasking
- **Expanded Player**: Full-featured player with album art and controls

### 👤 User Management
- **User Authentication**: Secure login/signup system with bcrypt password hashing
- **Personal Library**: Save and manage favorite songs
- **Profile Management**: Edit profile information and settings
- **Session Management**: Persistent user sessions across devices

### 🔐 Advanced Security
- **Face Authentication**: Optional biometric login using face recognition
- **Face Model Training**: Train personal face models for secure authentication
- **Model Management**: Add, update, or delete face authentication models
- **Fallback Authentication**: Traditional password login as backup

### 💻 Desktop Experience
- **Native Desktop App**: Built with PyWebView for native desktop experience
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Offline Capable**: Core functionality works without internet (cached content)
- **Auto-shutdown**: Graceful application termination

## 🏗️ Architecture

The application follows a microservices architecture with three main components:

### 1. Main Application (`app.py`)
- **Flask Web Server**: Core web application with routing and templating
- **PyWebView Integration**: Native desktop wrapper
- **Music Processing**: YouTube audio extraction using yt-dlp
- **API Gateway**: Coordinates between authentication and face recognition services

### 2. Authentication Service (`authentication/auth.py`)
- **User Management**: Registration, login, logout functionality
- **Password Security**: bcrypt hashing for secure password storage
- **Library Management**: Personal music library with CRUD operations
- **Session Handling**: Secure session management with MongoDB
- **Profile Management**: User profile updates and settings

### 3. Face Recognition Service (`faceservice/face_recognition_service.py`)
- **Face Detection**: OpenCV-based face detection and recognition
- **Model Training**: Face encoding generation and storage
- **Biometric Authentication**: Secure face-based login
- **Model Management**: Add, update, delete face models

## 🛠️ Technology Stack

### Backend
- **Flask**: Web framework for API and routing
- **PyWebView**: Desktop application wrapper
- **MongoDB**: Database for user data and face models
- **yt-dlp**: YouTube audio extraction
- **OpenCV**: Computer vision for face recognition
- **face_recognition**: Machine learning for face encoding

### Frontend
- **HTML5/CSS3**: Modern responsive web interface
- **JavaScript**: Interactive player controls and real-time updates
- **Font Awesome**: Icon library for UI elements
- **Progressive Web App**: PWA capabilities for mobile experience

### Machine Learning & AI
- **Face Recognition**: dlib-based face encoding
- **TensorFlow/Keras**: Deep learning framework support
- **NumPy/SciPy**: Mathematical computations
- **DeepFace**: Advanced face analysis

### Cloud & Deployment
- **Railway**: Cloud deployment platform
- **MongoDB Atlas**: Cloud database
- **Gunicorn**: WSGI HTTP Server
- **Nixpacks**: Build system for containerization

## 📦 Installation

### Prerequisites
- Python 3.8+
- MongoDB (local or Atlas)
- FFmpeg (for audio processing)
- Git

### Local Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Nikk-123/Spotify-3.0.git
   cd Spotify-3.0
   ```

2. **Create Virtual Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=your_mongodb_connection_string
   FACE_SERVICE_URL=http://localhost:5001
   AUTH_SERVICE_URL=http://localhost:5002
   ```

5. **Start Services**
   
   **Authentication Service:**
   ```bash
   cd authentication
   python auth.py
   ```
   
   **Face Recognition Service:**
   ```bash
   cd faceservice
   python face_recognition_service.py
   ```
   
   **Main Application:**
   ```bash
   python app.py
   ```

### Production Deployment

The application is configured for deployment on Railway with separate services:

1. **Main App**: Deployed from root directory
2. **Auth Service**: Deployed from `authentication/` directory
3. **Face Service**: Deployed from `faceservice/` directory

Each service includes:
- `Procfile` for process management
- `nixpacks.toml` for build configuration
- Service-specific `requirements.txt`

## 🎯 Usage

### Getting Started
1. **Launch Application**: Run `python app.py` or use the desktop executable
2. **Create Account**: Sign up with email and password
3. **Optional Face Setup**: Enable face authentication in settings
4. **Start Listening**: Search for music or browse mood playlists

### Face Authentication Setup
1. Go to **Settings** → **Face Authentication**
2. Click **"Enable Face Authentication"**
3. Position your face in the camera frame
4. Follow the on-screen instructions to capture training images
5. Wait for model training to complete
6. Use face login on future sessions

### Music Discovery
- **Search**: Type song names, artist names, or keywords
- **Trending**: Browse current popular music
- **Mood Playlists**: Select playlists based on your current mood
- **Library**: Access your saved favorite songs

### Player Controls
- **Basic Controls**: Play/pause, skip, previous, shuffle, repeat
- **Volume**: Adjust using volume slider
- **Progress**: Click on progress bar to seek
- **Queue**: View and manage upcoming songs
- **Library**: Add/remove songs from personal library

## 📁 Project Structure

```
Spotify-3.0/
├── app.py                          # Main Flask application
├── requirements.txt                # Main app dependencies
├── README.md                       # Project documentation
├── .env                           # Environment variables (not in repo)
│
├── authentication/                 # Authentication microservice
│   ├── auth.py                    # Authentication API
│   ├── requirements.txt           # Auth service dependencies
│   ├── Procfile                   # Railway deployment config
│   └── nixpacks.toml             # Build configuration
│
├── faceservice/                   # Face recognition microservice
│   ├── face_recognition_service.py # Face recognition API
│   ├── requirements.txt           # Face service dependencies
│   ├── Procfile                   # Railway deployment config
│   └── nixpacks.toml             # Build configuration
│
├── templates/                     # HTML templates
│   ├── dashboard.html            # Main music interface
│   ├── login.html                # Login page
│   ├── signup.html               # Registration page
│   ├── face_auth.html            # Face authentication setup
│   └── setting.html              # User settings
│
├── static/                       # Static assets
│   ├── css/                      # Stylesheets
│   │   ├── style.css            # Main styles
│   │   ├── mini-player.css      # Mini player styles
│   │   ├── expanded-player.css  # Full player styles
│   │   └── settings.css         # Settings page styles
│   └── js/                       # JavaScript files
│       └── player.js             # Music player logic
│
├── models/                       # ML models (if any)
├── Uploads/                      # Temporary file storage
└── .vscode/                      # VS Code configuration
    └── settings.json
```

## 🔧 Configuration

### Environment Variables
- `MONGO_URI`: MongoDB connection string
- `FACE_SERVICE_URL`: Face recognition service URL
- `AUTH_SERVICE_URL`: Authentication service URL

### Service URLs
- **Development**:
  - Main App: `http://localhost:8000`
  - Auth Service: `http://localhost:5002`
  - Face Service: `http://localhost:5001`

- **Production**:
  - Main App: Your Railway app URL
  - Auth Service: `https://groovoauth-production.up.railway.app/`
  - Face Service: `https://groovoface-production.up.railway.app/`

## 🛡️ Security Features

### Authentication Security
- **Password Hashing**: bcrypt with salt for secure password storage
- **Session Management**: Secure server-side sessions
- **Input Validation**: Comprehensive input sanitization
- **CORS Protection**: Configured for secure cross-origin requests

### Face Recognition Security
- **Local Processing**: Face data processed locally when possible
- **Encrypted Storage**: Face models stored as encrypted blobs
- **Model Isolation**: User face models are isolated and secure
- **Fallback Authentication**: Traditional login always available

### Data Protection
- **Environment Variables**: Sensitive data in environment variables
- **Database Security**: MongoDB with authentication and encryption
- **HTTPS**: SSL/TLS encryption for production deployments
- **Rate Limiting**: API rate limiting to prevent abuse

## 🚀 Performance Optimizations

### Audio Streaming
- **Adaptive Quality**: Automatic quality adjustment based on connection
- **Caching**: Intelligent caching of frequently played songs
- **Preloading**: Next song preloading for seamless playback
- **Error Recovery**: Automatic retry and fallback mechanisms

### Face Recognition
- **Model Optimization**: Optimized face models for faster recognition
- **Background Processing**: Non-blocking face recognition
- **Error Handling**: Graceful degradation when face service unavailable

### Frontend Performance
- **Lazy Loading**: On-demand loading of non-critical resources
- **Image Optimization**: Thumbnail optimization and caching
- **Minification**: Minified CSS and JavaScript in production
- **Progressive Enhancement**: Core functionality works without JavaScript

## 🐛 Troubleshooting

### Common Issues

**1. Audio Not Playing**
- Check internet connection
- Verify YouTube URL accessibility
- Clear browser cache
- Check browser audio permissions

**2. Face Recognition Not Working**
- Ensure camera permissions granted
- Check camera hardware functionality
- Verify face service is running
- Try traditional login as fallback

**3. Login Issues**
- Verify MongoDB connection
- Check auth service status
- Clear browser cookies/session
- Ensure correct credentials

**4. Desktop App Not Starting**
- Check Python version (3.8+ required)
- Verify all dependencies installed
- Check for port conflicts (8000, 5001, 5002)
- Review console logs for errors

### Debug Mode
Enable debug mode by setting `debug=True` in Flask configuration:
```python
app.run(debug=True, use_reloader=False, port=8000)
```

## 🤝 Contributing

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Guidelines
- Follow PEP 8 for Python code
- Use meaningful commit messages
- Add comments for complex logic
- Test thoroughly before submitting
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Chayan (Nikk-123)**
- GitHub: [@Nikk-123](https://github.com/Nikk-123)
- Project: [Spotify-3.0](https://github.com/Nikk-123/Spotify-3.0)

## 🙏 Acknowledgments

- **YouTube**: For providing the music content platform
- **OpenCV & dlib**: For computer vision and face recognition capabilities
- **Flask Community**: For the excellent web framework
- **Railway**: For reliable cloud hosting
- **MongoDB**: For robust database solutions
- **Font Awesome**: For beautiful icons
- **All Contributors**: Thanks to everyone who contributed to this project

---

**GROOVO** - *Your Music, Your Way, Your Face!* 🎵🎭

*Previously known as "Gareeb Ka Spotify" - bringing premium music experience to everyone!*

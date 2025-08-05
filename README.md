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
- **Native Desktop App**: Standalone executable built with PyWebView
- **Integrated Services**: All microservices bundled in single executable
- **Auto-configuration**: Zero-setup deployment with automated service management
- **Plug & Play**: Download and run - no technical knowledge required

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
- **GitHub Actions**: Automated CI/CD pipeline for executable generation
- **Railway**: Cloud deployment platform for microservices
- **MongoDB Atlas**: Cloud database integration
- **Automated Builds**: Continuous integration and deployment
- **Cross-platform Packaging**: Executable generation for Windows

## 📦 Installation & Setup

### 🚀 Quick Start (Recommended)

**For End Users - Plug & Play Experience:**

1. **Download the Latest Release**
   - Visit the [GitHub Releases](https://github.com/Nikk-123/GROOVO/releases) page
   - Download the latest `GROOVO.exe` file for Windows
   - No additional installations required!

2. **Run the Application**
   - Double-click `GROOVO.exe` to launch
   - The application will automatically start with all services integrated
   - Create your account and start enjoying music immediately

3. **First Launch Setup**
   - The app will automatically configure all necessary components
   - No technical setup required - everything works out of the box
   - Internet connection required for music streaming

### 🛠️ For Developers Only

**Prerequisites for Development:**
- Python 3.8+
- MongoDB (local or Atlas)
- FFmpeg (for audio processing)
- Git

**Development Setup:**

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Nikk-123/GROOVO.git
   cd GROOVO
   ```

2. **Create Virtual Environment**
   ```bash
   python -m venv venv
   venv\Scripts\activate
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

5. **Start Development Services**
   
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

### 🏭 Production Deployment

The application is built and packaged automatically using GitHub Actions:

- **Desktop Distribution**: Automated .exe generation for Windows
- **Cloud Services**: Microservices deployed on Railway
- **CI/CD Pipeline**: Automatic builds on every release

## 🎯 Getting Started

### 🎮 For End Users (Simple & Easy)

1. **Download & Launch**
   - Download `GROOVO.exe` from [GitHub Releases](https://github.com/Nikk-123/GROOVO/releases)
   - Run the executable - no installation needed!
   - The app starts automatically with all features ready

2. **Create Your Account**
   - Sign up with email and password on first launch
   - All data is securely stored and synchronized

3. **Optional: Setup Face Authentication**
   - Go to Settings → Face Authentication
   - Follow the simple on-screen instructions
   - Enable biometric login for enhanced security

4. **Start Enjoying Music**
   - Search for your favorite songs
   - Browse mood-based playlists
   - Build your personal music library

### 🔧 System Requirements

- **Operating System**: Windows 10/11 (64-bit)
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 500MB free space
- **Internet**: Stable internet connection for streaming
- **Camera**: Optional, for face authentication feature

### 🎵 Using the Music Player

**Music Discovery:**
- **Search**: Type song names, artist names, or keywords in the search bar
- **Trending**: Browse current popular music from the trending section
- **Mood Playlists**: Select pre-curated playlists based on your current mood
- **Personal Library**: Access and manage your saved favorite songs

**Player Controls:**
- **Basic Controls**: Play/pause, skip, previous, shuffle, repeat modes
- **Volume Control**: Adjust using the volume slider with visual feedback
- **Progress Tracking**: Click on progress bar to seek to any position
- **Queue Management**: View and rearrange upcoming songs
- **Mini/Expanded View**: Switch between compact and full player modes

**Face Authentication (Optional):**
1. Navigate to **Settings** → **Face Authentication**
2. Click **"Enable Face Authentication"**
3. Position your face clearly in the camera frame
4. Follow the step-by-step on-screen instructions
5. Wait for the AI model training to complete
6. Enjoy secure biometric login on future app launches

## 📁 Project Structure

```
GROOVO/
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

**1. Application Won't Start**
- Ensure you have Windows 10/11 (64-bit)
- Run as administrator if needed
- Check antivirus isn't blocking the executable
- Download the latest version from GitHub releases

**2. Audio Not Playing**
- Check your internet connection
- Verify system audio is working
- Try restarting the application
- Ensure firewall isn't blocking the app

**3. Face Recognition Not Working**
- Grant camera permissions when prompted
- Ensure your camera is working properly
- Make sure you have good lighting
- Use traditional login as backup option

**4. Login/Account Issues**
- Verify your internet connection
- Check if you're using correct credentials
- Try creating a new account if persistent issues
- Contact support if problems continue

**5. Performance Issues**
- Close other resource-intensive applications
- Ensure you have adequate RAM available
- Check internet speed for smooth streaming
- Restart the application if it becomes sluggish

### 📞 Support

If you encounter any issues:
- Check the [GitHub Issues](https://github.com/Nikk-123/GROOVO/issues) page
- Create a new issue with detailed description
- Include system information and error messages

## 👨‍💻 Developer

**Chayan (Nikk-123)**
- GitHub: [@Nikk-123](https://github.com/Nikk-123)
- Project: [GROOVO](https://github.com/Nikk-123/GROOVO)

*This project was built entirely by me as a solo developer. Every line of code, feature, and design element has been crafted with passion and dedication.*

## 📥 Download

🔗 **[Download GROOVO.exe](https://github.com/Nikk-123/GROOVO/releases)** - Latest Release

*Get the complete music streaming experience with just one click!*

---

**GROOVO** - *Your Music, Your Way, Your Face!* 🎵🎭

*Previously known as "Gareeb Ka Spotify" - bringing premium music experience to everyone!*

<div align="center">

# 🎵 GROOVO

### *Your Music, Your Way, Your Face!*

[![GitHub Release](https://img.shields.io/github/v/release/Nikk-123/GROOVO?style=for-the-badge&logo=github&color=blueviolet)](https://github.com/Nikk-123/GROOVO/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue?style=for-the-badge&logo=windows)](https://github.com/Nikk-123/GROOVO/releases)
[![Python](https://img.shields.io/badge/Python-3.8+-yellow?style=for-the-badge&logo=python)](https://www.python.org/)

**A premium music streaming application with AI-powered face authentication**  
*Stream unlimited music from YouTube with advanced features - completely free!*

[Download](#-download) • [Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation)

---

</div>

## 🌟 Overview

**GROOVO** (formerly *Gareeb Ka Spotify*) is a feature-rich desktop music streaming application that brings you unlimited music with cutting-edge AI features. Stream directly from YouTube, enjoy mood-based playlists, and secure your account with revolutionary face authentication technology.

> [!IMPORTANT]
> **🚀 Quick Install**: Download the latest `GROOVO.exe` from [Releases](https://github.com/Nikk-123/GROOVO/releases) - no installation required, just download and play!

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎶 **Music Streaming**
- 🎵 **Unlimited YouTube Music** - High-quality audio extraction
- 🔍 **Smart Search** - Intelligent search with auto-suggestions
- 🔥 **Trending Tracks** - Real-time popular music
- ❤️ **Personal Library** - Save and organize your favorites
- 📱 **Mini & Expanded Player** - Flexible viewing modes

</td>
<td width="50%">

### 🎭 **AI & Biometrics**
- 🤖 **Face Authentication** - Secure biometric login
- 🧠 **AI Model Training** - Personal face recognition
- 🔐 **Enhanced Security** - bcrypt password encryption
- 🎯 **Smart Fallback** - Traditional login always available
- 💾 **Model Management** - Add/update/delete face models

</td>
</tr>
<tr>
<td width="50%">

### 🎨 **User Experience**
- 🌈 **10+ Mood Playlists** - Curated for every vibe
- 🎛️ **Advanced Controls** - Shuffle, repeat, queue management
- 🔊 **Volume Control** - Visual feedback and precision
- ⏱️ **Progress Tracking** - Seek to any position instantly
- 💻 **Native Desktop** - PyWebView-powered interface

</td>
<td width="50%">

### 🛠️ **Technology**
- ⚡ **Microservices Architecture** - Scalable and efficient
- 🌐 **Cloud Integration** - Railway deployment
- 🗄️ **MongoDB Atlas** - Secure cloud database
- 🔄 **Auto CI/CD** - GitHub Actions automation
- 📦 **One-Click Deploy** - Plug & play executable

</td>
</tr>
</table>

### 🎵 Available Mood Playlists

<div align="center">

| 😊 Happy & Upbeat | 🧘 Chill & Lofi | 💪 Workout | 📚 Focus & Study | 🎉 Party Hits |
|:-:|:-:|:-:|:-:|:-:|
| 🎊 Bollywood Party | 🎻 Classical Indian | 🙏 Bhakti Songs | 💕 Romantic | 🎶 Punjabi Hits |

</div>

---

## 🚀 Quick Start

### 📥 **For Users** (Recommended)

> **3 Simple Steps** - No technical knowledge required!

```
1️⃣ Download GROOVO.exe from GitHub Releases
2️⃣ Double-click to launch (automatic setup)
3️⃣ Create account & start streaming music!
```

**[⬇️ Download Latest Release](https://github.com/Nikk-123/GROOVO/releases/latest)**

### 🛠️ **For Developers**

<details>
<summary><b>💻 Development Setup (Click to expand)</b></summary>

#### Prerequisites
- Python 3.8 or higher
- MongoDB (local or Atlas)
- FFmpeg (audio processing)
- Git

#### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/Nikk-123/GROOVO.git
cd GROOVO

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
# Create .env file with:
# MONGO_URI=your_mongodb_connection_string
# FACE_SERVICE_URL=http://localhost:5001
# AUTH_SERVICE_URL=http://localhost:5002

# 5. Start services (in separate terminals)

# Terminal 1 - Authentication Service
cd authentication
python auth.py

# Terminal 2 - Face Recognition Service
cd faceservice
python face_recognition_service.py

# Terminal 3 - Main Application
python app.py
```

</details>

---

## 🏗️ Architecture

<div align="center">

```mermaid
graph TB
    A[🖥️ Desktop App<br/>PyWebView] --> B[🌐 Flask Main App<br/>app.py]
    B --> C[🔐 Auth Service<br/>Port 5002]
    B --> D[🤖 Face Service<br/>Port 5001]
    C --> E[(🗄️ MongoDB Atlas)]
    D --> E
    B --> F[📺 YouTube<br/>yt-dlp]
    
    style A fill:#ff6b6b
    style B fill:#4ecdc4
    style C fill:#45b7d1
    style D fill:#96ceb4
    style E fill:#ffeaa7
    style F fill:#fd79a8
```

</div>

### 📦 Microservices

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| **Main App** | 8000 | Flask + PyWebView | UI, routing, music processing |
| **Authentication** | 5002 | Flask + bcrypt | User management, sessions |
| **Face Recognition** | 5001 | Flask + OpenCV | Biometric authentication |
| **Database** | - | MongoDB Atlas | User data, face models |

---

## 💻 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | Windows 10 (64-bit) | Windows 11 (64-bit) |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 500 MB | 1 GB |
| **Internet** | Stable broadband | High-speed connection |
| **Camera** | Optional | For face authentication |

---

## 🛠️ Technology Stack

<div align="center">

### Backend
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)

### Frontend
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

### Deployment
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

</div>

<details>
<summary><b>🔧 Complete Tech Stack (Click to expand)</b></summary>

#### Backend Technologies
- **Flask** - Web framework for API and routing
- **PyWebView** - Desktop application wrapper
- **MongoDB Atlas** - Cloud database for user data
- **yt-dlp** - YouTube audio extraction
- **OpenCV** - Computer vision for face detection
- **face_recognition** - dlib-based face encoding
- **bcrypt** - Password hashing and security

#### Frontend Technologies
- **HTML5/CSS3** - Modern responsive interface
- **Vanilla JavaScript** - Interactive player controls
- **Font Awesome** - Icon library
- **Progressive Web App** - PWA capabilities

#### Machine Learning & AI
- **dlib** - Face recognition algorithms
- **NumPy** - Mathematical computations
- **face_recognition** - Pre-trained face encoding models

#### DevOps & Deployment
- **GitHub Actions** - CI/CD pipeline
- **Railway** - Cloud deployment platform
- **PyInstaller** - Executable generation
- **MongoDB Atlas** - Cloud database hosting

</details>

---

## 📁 Project Structure

<details>
<summary><b>🗂️ Directory Layout (Click to expand)</b></summary>

```
GROOVO/
│
├── 📄 app.py                       # Main Flask application
├── 📄 requirements.txt             # Dependencies
├── 📄 README.md                    # This file
├── 🔒 .env                        # Environment configuration
│
├── 🔐 authentication/              # Authentication microservice
│   ├── auth.py                    # Auth API endpoints
│   ├── requirements.txt           # Auth dependencies
│   ├── Procfile                   # Railway config
│   └── nixpacks.toml             # Build settings
│
├── 🤖 faceservice/                # Face recognition microservice
│   ├── face_recognition_service.py
│   ├── requirements.txt
│   ├── Procfile
│   └── nixpacks.toml
│
├── 📱 templates/                  # HTML templates
│   ├── dashboard.html            # Main interface
│   ├── login.html                # Login page
│   ├── signup.html               # Registration
│   ├── face_auth.html            # Face setup
│   └── setting.html              # Settings
│
├── 🎨 static/                     # Static assets
│   ├── css/                      # Stylesheets
│   │   ├── style.css
│   │   ├── mini-player.css
│   │   ├── expanded-player.css
│   │   └── settings.css
│   ├── js/                       # JavaScript
│   │   └── player.js
│   └── icons/                    # App icons
│
├── 🧠 models/                     # ML models
├── 📤 Uploads/                    # Temp storage
└── ⚙️ .github/                    # GitHub Actions
    └── workflows/
        └── release-build.yml      # Auto-build workflow
```

</details>

---

## 🎮 User Guide

### 🎵 **Music Discovery**

- **🔍 Search** - Type song names, artists, or keywords
- **🔥 Trending** - Browse current popular tracks
- **🎭 Mood Playlists** - Select from 10+ curated playlists
- **❤️ Library** - Manage your saved favorites

### 🎛️ **Player Controls**

| Control | Function |
|---------|----------|
| ⏯️ Play/Pause | Start or pause playback |
| ⏭️ Next/⏮️ Previous | Skip tracks |
| 🔀 Shuffle | Randomize playlist order |
| 🔁 Repeat | Loop current track/playlist |
| 🔊 Volume | Adjust audio level |
| ⏱️ Seek | Jump to any position |

### 🤖 **Face Authentication Setup**

> [!TIP]
> Face authentication is optional but adds an extra layer of security and convenience!

1. Navigate to ⚙️ **Settings** → 🤖 **Face Authentication**
2. Click **"Enable Face Authentication"**
3. Position your face in the camera frame
4. Follow on-screen instructions (usually 3-5 captures)
5. Wait for AI model training (~30 seconds)
6. ✅ Done! Use face login on next launch

---

## 🔧 Configuration

### 🌍 Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/groovo

# Microservice URLs (Development)
FACE_SERVICE_URL=http://localhost:5001
AUTH_SERVICE_URL=http://localhost:5002

# Production URLs (if deploying)
FACE_SERVICE_URL=https://groovoface-production.up.railway.app
AUTH_SERVICE_URL=https://login-auth-jgxb.onrender.com
```

### 🌐 Service URLs

| Environment | Main App | Auth Service | Face Service |
|-------------|----------|--------------|--------------|
| **Development** | `localhost:8000` | `localhost:5002` | `localhost:5001` |
| **Production** | Railway URL | `login-auth-jgxb.onrender.com` | `groovoface-*.railway.app` |

---

## 🛡️ Security & Privacy

<table>
<tr>
<td width="50%">

### 🔐 Authentication Security
- ✅ **bcrypt Hashing** - Industry-standard password encryption
- ✅ **Session Management** - Secure server-side sessions
- ✅ **Input Validation** - Comprehensive sanitization
- ✅ **CORS Protection** - Secure cross-origin requests

</td>
<td width="50%">

### 🤖 Face Recognition Security
- ✅ **Local Processing** - Face data processed securely
- ✅ **Encrypted Storage** - Models stored as encrypted blobs
- ✅ **User Isolation** - Face models are user-specific
- ✅ **Fallback Login** - Password login always available

</td>
</tr>
</table>

### 🛡️ Data Protection

> [!NOTE]
> Your privacy is our priority. All face data is encrypted and stored securely in MongoDB with user-level isolation.

- **Environment Variables** - Sensitive credentials never hardcoded
- **Database Encryption** - MongoDB authentication & encryption at rest
- **HTTPS** - SSL/TLS for all production deployments
- **Rate Limiting** - API abuse prevention

---

## ⚡ Performance Features

### 🎵 Audio Streaming
- **Adaptive Quality** - Auto-adjusts based on connection speed
- **Smart Preloading** - Next song loads in background
- **Error Recovery** - Automatic retry with fallback mechanisms

### 🤖 Face Recognition
- **Optimized Models** - Fast recognition (<1 second)
- **Background Processing** - Non-blocking authentication
- **Graceful Degradation** - Falls back to password if service unavailable

### 🎨 Frontend
- **Lazy Loading** - On-demand resource loading
- **Image Optimization** - Thumbnail caching
- **Minification** - Compressed assets in production
- **Progressive Enhancement** - Works without JavaScript

---

## 🐛 Troubleshooting

<details>
<summary><b>❌ Application Won't Start</b></summary>

- ✅ Ensure Windows 10/11 (64-bit)
- ✅ Run as administrator
- ✅ Check antivirus isn't blocking `GROOVO.exe`
- ✅ Download latest version from [Releases](https://github.com/Nikk-123/GROOVO/releases)
- ✅ Verify system meets [requirements](#-system-requirements)

</details>

<details>
<summary><b>🔇 Audio Not Playing</b></summary>

- ✅ Check internet connection
- ✅ Verify system audio is working
- ✅ Restart the application
- ✅ Ensure firewall isn't blocking the app
- ✅ Try different songs (some may be region-restricted)

</details>

<details>
<summary><b>🤖 Face Recognition Issues</b></summary>

- ✅ Grant camera permissions when prompted
- ✅ Ensure camera is working (test in other apps)
- ✅ Verify good lighting conditions
- ✅ Remove glasses/hats during setup
- ✅ Use password login as backup

</details>

<details>
<summary><b>🔐 Login/Account Problems</b></summary>

- ✅ Verify internet connection
- ✅ Check credentials (case-sensitive)
- ✅ Try password reset (if implemented)
- ✅ Create new account if issues persist
- ✅ Contact support via [GitHub Issues](https://github.com/Nikk-123/GROOVO/issues)

</details>

<details>
<summary><b>🐌 Performance Issues</b></summary>

- ✅ Close other resource-intensive apps
- ✅ Ensure 4GB+ RAM available
- ✅ Check internet speed (use speedtest.net)
- ✅ Restart application
- ✅ Clear browser cache (if using web version)

</details>

---

## 📞 Support

Having issues? We're here to help!

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Nikk-123/GROOVO/issues)
- 💬 **Questions**: [Discussions](https://github.com/Nikk-123/GROOVO/discussions)
- 📧 **Contact**: Open an issue with `question` label

> [!TIP]
> When reporting issues, include:
> - OS version (Windows 10/11)
> - GROOVO version (check in About)
> - Error messages/screenshots
> - Steps to reproduce

---

## 👨‍💻 Developer

<div align="center">

**Built with ❤️ by Chayan**

[![GitHub](https://img.shields.io/badge/GitHub-Nikk--123-181717?style=for-the-badge&logo=github)](https://github.com/Nikk-123)
[![Project](https://img.shields.io/badge/Project-GROOVO-blueviolet?style=for-the-badge&logo=github)](https://github.com/Nikk-123/GROOVO)

*Solo developer passionate about creating accessible music experiences*  
*Every line of code crafted with dedication and attention to detail*

</div>

---

## 📥 Download

<div align="center">

### 🚀 **Get GROOVO Now!**

[![Download GROOVO](https://img.shields.io/badge/Download-GROOVO.exe-success?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Nikk-123/GROOVO/releases/latest)

**One-click installation • No setup required • Start streaming instantly!**

[View All Releases](https://github.com/Nikk-123/GROOVO/releases) • [What's New](https://github.com/Nikk-123/GROOVO/releases/latest)

</div>

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **yt-dlp** - For excellent YouTube extraction
- **OpenCV & dlib** - For computer vision capabilities
- **MongoDB** - For reliable cloud database
- **Railway** - For seamless cloud deployment
- **Community** - For feedback and support

---

<div align="center">

### 🎵 **GROOVO**
*Your Music, Your Way, Your Face!* 🎭

**Previously known as "Gareeb Ka Spotify"**  
*Bringing premium music experience to everyone - absolutely free!*

---

Made with 💜 in India | © 2024 Chayan (Nikk-123)

[![⭐ Star this repo](https://img.shields.io/github/stars/Nikk-123/GROOVO?style=social)](https://github.com/Nikk-123/GROOVO/stargazers)
[![🍴 Fork this repo](https://img.shields.io/github/forks/Nikk-123/GROOVO?style=social)](https://github.com/Nikk-123/GROOVO/fork)

</div>


<div align="center">
  <h1>🎵 Groovo</h1>
  <p><b>A modern, unified music streaming ecosystem across all your devices.</b></p>
</div>

---

## 🌟 What is Groovo?

Groovo is a comprehensive, open-source music streaming platform built as a monorepo. It combines a powerful YouTube Music client with robust local music playback capabilities, wrapping it all in a sleek, modern UI. Whether you are at your desk, on the go, or managing your library, Groovo provides a unified, ad-free listening experience.

---

## ✨ Ecosystem Features

* **Cross-Platform Harmony**: Dedicated applications for Android, Desktop PC, and a Web Admin dashboard.
* **Seamless Playback**: Enjoy uninterrupted, ad-free streaming with full background playback support.
* **Offline & Local Integration**: Download your favorite tracks for offline listening and play your local audio files (MP3, FLAC, OGG, etc.) seamlessly alongside streamed content.
* **Synchronized Lyrics**: Rich support for synchronized lyrics, including word-by-word/Karaoke formats (LRC, TTML).
* **Custom Audio Engine**: Fine-tune your listening with audio normalization, pitch/tempo adjustment, and crossfading capabilities.
* **Unified Synchronization**: Keep your playlists, history, and preferences synced across the entire ecosystem through our dedicated authentication service.

---

## 📱 The Mobile Experience (Android)

Our flagship Groovo Android application is a supercharged Material 3 YouTube Music client and local media player built for power users.

* **Sleek Material You Design**: A beautiful interface that adapts to your system theme.
* **Simultaneous Playback**: Mix local and streamed music in the same queue seamlessly.
* **Advanced Metadata**: Uses a custom, robust tag extractor for local files, replacing the broken native MediaStore extractor.
* **Multiple Queues**: Manage different listening sessions at the same time.
* **Android Auto Support**: Take your unified music library on the road securely.

---

## 🏗️ Architecture (Android)

The Android app follows an MVVM + Repository pattern with Hilt-based dependency injection.

* **Presentation**: Jetpack Compose screens coordinated by `MainActivity`.
* **ViewModels**: Extensive feature ViewModels (Hilt-injected) drive UI state.
* **Services**: `MusicService` (Media3) for playback and `ExoDownloadService` for downloads.
* **Data Layer**: Room (`MusicDatabase`) stores library, playlists, and history.
* **Network Layer**: Ktor `HttpClient` for auth and library sync; Innertube/YouTube, KuGou, and LrcLib integrations for content/lyrics.
* **Caching**: Media3 caches and on-device data stores for settings and sync state.

Diagrams are exported to the `diagrams/` folder as `.drawio` and `.png`.

---

## 📁 Repository Structure

```text
Groovo/
├── apps/
│   ├── admin/           # Web admin dashboard (Flask on Vercel)
│   ├── android/         # Flagship Android mobile application (Kotlin)
│   └── desktop/         # Desktop application (Python/Flask/Webview)
└── services/
    └── authentication/  # Core service for managing user sessions and cross-platform sync
```

---

## 🚀 Getting Started & How to Use

Welcome to the Groovo repository! Because Groovo is a platform ecosystem, each application has its own specific entry point. Follow the steps below depending on how you want to use or develop Groovo.

### 1. 🔑 Backend Services (Start Here)

Before launching the client applications, you need to ensure the core authentication service is running to handle logins and data sync.

* Navigate to the `services/authentication` directory.
* Copy the `.env.example` file to create a new `.env` file. Fill in your database URL and secret keys.
* Follow the instructions in the service's specific README to start the local backend server.

### 2. 📱 Android Application

* Navigate to `apps/android`.
* Open the project using **Android Studio**.
* Ensure you configure `local.properties` as per the mobile app's setup guide.
* Sync Gradle, then build and deploy the APK directly to your physical device or emulator.

### 3. 💻 Desktop PC App

* Navigate to `apps/desktop`.
* Create a fresh Python virtual environment: `python -m venv venv`
* Activate the environment and install the required dependencies: `pip install -r requirements.txt`
* Run the main Python startup script to launch the Flask backend and Webview frontend.

### 4. 🎛️ Admin Dashboard

* Navigate to `apps/admin`.
* Install the necessary Node packages using `npm install` or `yarn install`.
* Ensure your `.env` file is properly configured to point to your locally running authentication service.
* Run `npm start` to launch the React development server.

---

## 🔒 Environment Variables

Authentication and other sensitive URL configurations are managed via `.env` files located inside each specific app. Ensure you have properly configured the required `.env` files before launching the clients to prevent connection errors.

---

## 🤝 Contributing

We love our contributors! Whether you're fixing bugs, adding new platform features, translating the app into your language, or improving documentation, your help is always welcome. Please read the Contribution Guidelines found in the respective app directories before opening a Pull Request.

---

## 🧑‍💻 Author

[@Nikk-123](https://github.com/Nikk-123)

---

> **Disclaimer**: This project and its contents are not affiliated with, funded, authorized, endorsed by, or in any way associated with YouTube, Google LLC, or any of its affiliates and subsidiaries. Any trademark, service mark, trade name, or other intellectual property rights used in this project are owned by the respective owners.

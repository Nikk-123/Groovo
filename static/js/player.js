// Keep-Alive Manager for Render Cold Start Prevention (Adaptive Version)
class KeepAliveManager {
    constructor() {
        this.intervalId = null;
        this.baseInterval = 600000; // 10 minutes (fallback)
        this.currentInterval = 600000; // Will be updated dynamically from server
        this.jitterRange = 120000; // ±2 minutes randomization
        this.endpoint = '/api/keepalive/ping';
        this.lastServiceActivity = Date.now();
        this.skipThreshold = 300000; // 5 minutes
        this.clientId = this.generateClientId();
    }

    generateClientId() {
        // Generate a persistent client ID for tracking
        let id = localStorage.getItem('groovo_client_id');
        if (!id) {
            id = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('groovo_client_id', id);
        }
        return id;
    }

    // Call this when any successful request is made to the auth service
    recordServiceActivity() {
        this.lastServiceActivity = Date.now();
        console.log('[KeepAlive] Service activity recorded');
    }

    shouldSkipPing() {
        const timeSinceActivity = Date.now() - this.lastServiceActivity;
        return timeSinceActivity < this.skipThreshold;
    }

    async ping() {
        // Skip if service was recently active (optimization to reduce load)
        if (this.shouldSkipPing()) {
            console.log('[KeepAlive] Skipping ping - service recently active');
            // Still reschedule next ping
            this.scheduleNextPing();
            return;
        }

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ client_id: this.clientId })
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[KeepAlive] Active users: ${data.active_users} | Interval: ${data.recommended_interval_min}min | Total load: ~${data.target_pings_per_hour} pings/hour`);

                // Update interval dynamically based on server recommendation
                this.currentInterval = data.recommended_interval_ms;
                this.recordServiceActivity();
            } else {
                console.warn('[KeepAlive] Server returned error, using fallback interval');
            }
        } catch (error) {
            console.warn('[KeepAlive] Ping failed:', error.message);
        }

        // Schedule next ping with updated interval
        this.scheduleNextPing();
    }

    scheduleNextPing() {
        // Clear any existing scheduled ping
        if (this.intervalId) {
            clearTimeout(this.intervalId);
        }

        // Add jitter to current interval to prevent synchronized pings
        const jitter = Math.random() * this.jitterRange * 2 - this.jitterRange;
        const nextInterval = Math.max(0, this.currentInterval + jitter);

        this.intervalId = setTimeout(() => {
            this.ping();
        }, nextInterval);
    }

    start() {
        if (this.intervalId) return; // Already running

        // Immediate ping to register and get initial interval
        setTimeout(() => this.ping(), Math.random() * 5000);
        console.log('[KeepAlive] Started with adaptive intervals based on user count');
    }

    stop() {
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
            console.log('[KeepAlive] Stopped');
        }
    }
}

// Initialize keep-alive manager
const keepAliveManager = new KeepAliveManager();

// Analytics Tracking Module
const Analytics = {
    AUTH_SERVICE_URL: '', // Send to local app which will proxy to auth service

    async trackEvent(endpoint, data) {
        try {
            const response = await fetch(`${this.AUTH_SERVICE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // ← ADD THIS LINE
                body: JSON.stringify(data)
            });

            // ← ADD THIS CHECK
            if (!response.ok) {
                console.warn(`Analytics tracking failed for ${endpoint}: ${response.status} ${response.statusText}`);
                return;
            }

            console.log(`Analytics: ${endpoint} tracked successfully`);

            // Record service activity to prevent redundant keep-alive pings
            keepAliveManager.recordServiceActivity();
        } catch (error) {
            console.warn(`Analytics tracking failed for ${endpoint}:`, error);
        }
    },

    trackPlay(song) {
        this.trackEvent('/api/track/play', { song });
    },

    trackPause(songUrl, listenDuration) {
        this.trackEvent('/api/track/pause', {
            song_url: songUrl,
            listen_duration: listenDuration
        });
    },

    trackComplete(songUrl, listenDuration) {
        this.trackEvent('/api/track/complete', {
            song_url: songUrl,
            listen_duration: listenDuration
        });
    },

    trackSkip(songUrl, listenDuration) {
        this.trackEvent('/api/track/skip', {
            song_url: songUrl,
            listen_duration: listenDuration
        });
    }
};

// Core State Management
const PlayerState = {
    queue: [],
    currentIndex: 0,
    isPlaying: false,
    library: [],
    isShuffleOn: false,
    repeatMode: 'off',
    currentSong: null,
    volume: 1.0,
    audio: new Audio(), // Replace AudioContext with HTML5 Audio
    lastPlayRequest: 0,
    playCooldown: 1000,
    isProcessingPlay: false,
    retryCount: 0,
    maxRetries: 3,
    shuffledQueue: [],
    libraryQueue: [],
    customRepeat: {
        active: false,
        count: 0
    },
    playStartTime: 0 // Track when current song started playing
};

// DOM Elements (unchanged)
const Elements = {
    audio: document.getElementById('audioPlayer'),
    miniPlayer: document.querySelector('.mini-player'),
    expandedPlayer: document.querySelector('.expanded-player'),
    controls: {
        play: {
            mini: document.getElementById('miniPlayBtn'),
            main: document.getElementById('playBtn')
        },
        prev: {
            mini: document.getElementById('miniPrevBtn'),
            main: document.getElementById('prevBtn')
        },
        next: {
            mini: document.getElementById('miniNextBtn'),
            main: document.getElementById('nextBtn')
        },
        shuffle: {
            mini: document.getElementById('miniShuffleBtn'),
            main: document.getElementById('shuffleBtn')
        },
        repeat: {
            mini: document.getElementById('miniRepeatBtn'),
            main: document.getElementById('repeatBtn')
        },
        volume: {
            mini: document.getElementById('miniVolumeControl'),
            main: document.getElementById('volumeControl')
        }
    },
    display: {
        mini: {
            thumbnail: document.getElementById('miniThumbnail'),
            title: document.getElementById('miniSongTitle'),
            artist: document.getElementById('miniArtist')
        },
        main: {
            thumbnail: document.getElementById('currentThumbnail'),
            title: document.getElementById('currentSongTitle'),
            artist: document.getElementById('currentArtist')
        }
    },
    search: {
        input: document.getElementById('searchInput'),
        results: document.getElementById('searchResultsContainer'),
        list: document.getElementById('search-result'),
        loader: document.getElementById('loader'),
        trending: document.getElementById('trendingContainer')
    },
    progressBars: {
        mini: document.querySelector('.mini-player .progress-bar'),
        main: document.querySelector('.expanded-player .progress-bar')
    },
    minimizeBtn: document.querySelector('.minimize-btn'),
    homeBtn: document.querySelector('.home-btn'),
    profile: {
        btn: document.getElementById('profileBtn'),
        dropdown: document.getElementById('profileDropdown')
    }
};

// Core Player Functions
const Player = {
    async play(url, title, thumbnail, artist) {
        if (!url) return;

        const cleanUrl = this.cleanYouTubeUrl(url);
        if (!cleanUrl) {
            console.error('Invalid YouTube URL:', url);
            alert('Invalid YouTube URL. Please try another song.');
            return;
        }

        const now = Date.now();
        if (now - PlayerState.lastPlayRequest < PlayerState.playCooldown || PlayerState.isProcessingPlay) {
            return;
        }

        try {
            PlayerState.isProcessingPlay = true;
            PlayerState.lastPlayRequest = now;
            PlayerState.retryCount = 0;

            PlayerState.currentSong = { url: cleanUrl, title, thumbnail, artist };
            this.updateDisplay(title, artist, thumbnail);
            this.showControls(true);

            console.log('Fetching audio for URL:', cleanUrl);

            const response = await fetch('/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: cleanUrl })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Server response:', data);

            if (!data.success || !data.audio_url) {
                throw new Error(data.error || 'Failed to get audio URL');
            }

            await this.setupAudioPlayback(data.audio_url, data.duration);
            this.updateUIState(cleanUrl);
            this.updateMetadata(title, artist, thumbnail);

            // Track play event for analytics
            PlayerState.playStartTime = Date.now();
            Analytics.trackPlay({
                url: cleanUrl,
                title: title,
                thumbnail: thumbnail,
                artist: artist
            });

            // Save state
            this.saveState();

            PlayerState.isPlaying = true;
            this.updateAllPlayButtons(cleanUrl);

        } catch (error) {
            console.error('Error playing song:', error);
            await this.handlePlaybackError();
        } finally {
            PlayerState.isProcessingPlay = false;
        }
    },

    async togglePlayPause(url, title, thumbnail, artist) {
        // If this is the currently playing song, just toggle play/pause
        if (PlayerState.currentSong && PlayerState.currentSong.url === url) {
            PlaybackControls.togglePlayPause();
            return;
        }

        // If it's a different song, start playing it
        await this.play(url, title, thumbnail, artist);
    },

    cleanYouTubeUrl(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
                let videoId;
                if (urlObj.hostname.includes('youtube.com')) {
                    videoId = urlObj.searchParams.get('v');
                } else {
                    videoId = urlObj.pathname.slice(1);
                }
                if (!videoId) return null;
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
            return null;
        } catch (error) {
            console.error('Error cleaning URL:', error);
            return null;
        }
    },

    async setupAudioPlayback(audioUrl, duration) {
        try {
            // Pause and reset current audio
            PlayerState.audio.pause();
            PlayerState.audio.src = audioUrl;
            PlayerState.audio.volume = PlayerState.volume;

            // Setup event handlers
            PlayerState.audio.onended = () => {
                // Track completion before auto-advancing
                if (PlayerState.currentSong && PlayerState.playStartTime) {
                    const listenDuration = Math.floor((Date.now() - PlayerState.playStartTime) / 1000);
                    Analytics.trackComplete(PlayerState.currentSong.url, listenDuration);
                }
                PlaybackControls.playNext(true);
            };
            PlayerState.audio.onerror = (error) => {
                console.error('Audio playback error:', error);
                this.handlePlaybackError();
            };

            // Add timeupdate event listener
            PlayerState.audio.ontimeupdate = () => {
                const audio = PlayerState.audio;
                if (!audio || !audio.duration) return;

                const currentTime = audio.currentTime;
                const duration = audio.duration;
                const progressPercentage = (currentTime / duration) * 100;

                // Update progress bars
                const miniProgress = document.querySelector('.mini-player .progress');
                const mainProgress = document.querySelector('.expanded-player .progress');

                if (miniProgress) miniProgress.style.width = `${progressPercentage}%`;
                if (mainProgress) mainProgress.style.width = `${progressPercentage}%`;

                // Update time displays
                const formatTime = (seconds) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                };

                document.querySelectorAll('.current-time').forEach(el => {
                    el.textContent = formatTime(currentTime);
                });
                document.querySelectorAll('.total-time').forEach(el => {
                    el.textContent = formatTime(duration);
                });
            };

            // Start playback
            await PlayerState.audio.play();
            PlayerState.isPlaying = true;

        } catch (error) {
            console.error('Error setting up audio playback:', error);
            throw error;
        }
    },

    updateDisplay(title, artist, thumbnail) {
        ['mini', 'main'].forEach(type => {
            if (Elements.display[type].thumbnail) Elements.display[type].thumbnail.src = thumbnail || 'default_thumbnail.jpg';
            if (Elements.display[type].title) Elements.display[type].title.textContent = title || 'Unknown Title';
            if (Elements.display[type].artist) Elements.display[type].artist.textContent = artist || 'Unknown Artist';
        });

        // Update Expanded Player Background
        const expandedBg = document.getElementById('expandedBg');
        if (expandedBg) {
            expandedBg.style.backgroundImage = `url('${thumbnail || 'default_thumbnail.jpg'}')`;
        }

        if (PlayerState.currentSong) {
            Library.updateLikeButton(PlayerState.currentSong.url);
        }
    },

    showControls(show) {
        const display = show ? 'block' : 'none';
        document.getElementById('audioControlContainer').style.display = display;
        Elements.miniPlayer.style.display = show ? 'flex' : 'none';
    },

    updateUIState(url) {
        document.querySelectorAll('.song-item, .expanded-song-row').forEach(item => {
            const isCurrentSong = item.dataset.url === url;
            const isPlaying = isCurrentSong && PlayerState.isPlaying;
            item.classList.toggle('playing', isPlaying);

            const playBtn = item.querySelector('.play-btn i');
            if (playBtn) {
                playBtn.className = `fas fa-${isPlaying ? 'pause' : 'play'}`;
            }
        });

        // Update Liked Songs Header if needed
        Library.updateHeaderState();
    },

    updateMetadata(title, artist, thumbnail) {
        try {
            document.title = `${title} - ${artist}`;
            if ('mediaSession' in navigator && thumbnail) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: title || 'Unknown Title',
                    artist: artist || 'Unknown Artist',
                    artwork: thumbnail ? [{ src: thumbnail, sizes: '512x512', type: 'image/jpeg' }] : []
                });

                navigator.mediaSession.setActionHandler('play', () => PlaybackControls.togglePlayPause());
                navigator.mediaSession.setActionHandler('pause', () => PlaybackControls.togglePlayPause());
                navigator.mediaSession.setActionHandler('previoustrack', () => PlaybackControls.playPrevious());
                navigator.mediaSession.setActionHandler('nexttrack', () => PlaybackControls.playNext());
            }
        } catch (error) {
            console.warn('MediaMetadata error:', error);
        }
    },

    async handlePlaybackError() {
        if (!PlayerState.isPlaying && PlayerState.retryCount < PlayerState.maxRetries) {
            PlayerState.retryCount++;
            console.log(`Retrying playback (attempt ${PlayerState.retryCount}/${PlayerState.maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (PlayerState.currentSong) {
                await this.play(
                    PlayerState.currentSong.url,
                    PlayerState.currentSong.title,
                    PlayerState.currentSong.thumbnail,
                    PlayerState.currentSong.artist
                );
                return;
            }
        }

        alert('Failed to play the song after retries. Please try another one.');
        this.showControls(false);
        PlayerState.isPlaying = false;
        this.updateAllPlayButtons(PlayerState.currentSong?.url);
        PlayerState.currentSong = null;
    },

    updateAllPlayButtons(url) {
        const icon = PlayerState.isPlaying ? 'fa-pause' : 'fa-play';
        if (Elements.controls.play.mini) {
            Elements.controls.play.mini.innerHTML = `<i class="fas ${icon}"></i>`;
        }
        if (Elements.controls.play.main) {
            Elements.controls.play.main.innerHTML = `<i class="fas ${icon}"></i>`;
        }

        // Update Liked Songs Header Play Button
        const likedSongsPlayBtn = document.getElementById('likedSongsPlayBtn');
        if (likedSongsPlayBtn) {
            // Only show pause if we are actually playing from the library (or if we want 'Global Pause' logic visually?)
            // User said "IF ANY SONG IS PLAYING... PAUSE". So if ANY song is playing, button should probably show Pause (or remain Play but act as Pause).
            // Standard UI: If I am playing Trending, the Liked Songs button usually stays "Play".
            // If I click it, it pauses Trending.
            // But if I want to reflect the "Active" state of the button...
            // Let's stick to: If playing from Library, show Pause. If playing elsewhere, show Play (but it will pause).
            // Actually, if I show "Play" and clicking it Pauses... that's confusing. 
            // BUT if I show "Pause" when playing Trending... that implies "Trending is part of Liked Songs".
            // Let's implement: Show Pause ONLY if queue.type === 'library'.

            // Start with queue check
            let isLibraryQueue = PlayerState.queue && PlayerState.queue.type === 'library';

            // Fallback: If queue info is missing (e.g. restored state), check if current song is in library
            if (!isLibraryQueue && PlayerState.currentSong && PlayerState.library.length > 0) {
                isLibraryQueue = PlayerState.library.some(s => s.url === PlayerState.currentSong.url);
            }

            const libIcon = (PlayerState.isPlaying && isLibraryQueue) ? 'fa-pause' : 'fa-play';
            likedSongsPlayBtn.innerHTML = `<i class="fas ${libIcon}"></i>`;
        }
    },

    playFromLibrary(url, title, thumbnail, artist) {
        // Create library queue in REVERSED order to match display
        if (!PlayerState.libraryQueue.length) {
            if (PlayerState.library && PlayerState.library.length > 0) {
                // Reverse the library to match the display order
                PlayerState.libraryQueue = [...PlayerState.library].reverse();
            }
        }

        // Find the index of the clicked song in the REVERSED library queue
        const songIndex = PlayerState.libraryQueue.findIndex(song => song.url === url);
        if (songIndex !== -1) {
            PlayerState.currentIndex = songIndex;
            PlayerState.queue = PlayerState.libraryQueue; // Use reversed library as the current queue
        }

        // Tag the queue to identify it as the library queue
        if (PlayerState.queue) {
            PlayerState.queue.type = 'library';
        }

        // Play the selected song
        this.play(url, title, thumbnail, artist);
    },

    // Add new method for toggling play/pause from library
    togglePlayFromLibrary(url, title, thumbnail, artist) {
        if (PlayerState.currentSong && PlayerState.currentSong.url === url) {
            // If this is the current song, just toggle play/pause
            PlaybackControls.togglePlayPause();
        } else {
            // If it's a different song, start playing it
            this.playFromLibrary(url, title, thumbnail, artist);
        }
    },



    saveState() {
        if (PlayerState.currentSong) {
            const state = {
                song: PlayerState.currentSong,
                timestamp: Date.now()
            };
            localStorage.setItem('groovo_last_played', JSON.stringify(state));
        }
    },

    loadState() {
        try {
            const saved = localStorage.getItem('groovo_last_played');
            if (saved) {
                const state = JSON.parse(saved);
                if (state.song) {
                    PlayerState.currentSong = state.song;
                    this.updateDisplay(state.song.title, state.song.artist, state.song.thumbnail);
                    this.showControls(true);
                    this.updateAllPlayButtons(state.song.url);
                    // Don't auto-play, just show it ready
                }
            }
        } catch (error) {
            console.error('Error loading saved state:', error);
        }
    }
};

// Playback Controls
const PlaybackControls = {
    togglePlayPause() {
        if (!PlayerState.currentSong) return;

        // Check if we have audio source loaded (handling restored state)
        if (!PlayerState.audio.src && PlayerState.currentSong) {
            Player.play(
                PlayerState.currentSong.url,
                PlayerState.currentSong.title,
                PlayerState.currentSong.thumbnail,
                PlayerState.currentSong.artist
            );
            return;
        }

        if (PlayerState.isPlaying) {
            PlayerState.audio.pause();
            PlayerState.isPlaying = false;

            // Track pause event
            if (PlayerState.currentSong && PlayerState.playStartTime) {
                const listenDuration = Math.floor((Date.now() - PlayerState.playStartTime) / 1000);
                Analytics.trackPause(PlayerState.currentSong.url, listenDuration);
            }
        } else {
            PlayerState.audio.play();
            PlayerState.isPlaying = true;
            // Reset play start time when resuming
            PlayerState.playStartTime = Date.now();
        }
        Player.updateAllPlayButtons(PlayerState.currentSong.url);
        Library.updateHeaderState();
    },

    toggleShuffle() {
        PlayerState.isShuffleOn = !PlayerState.isShuffleOn;

        // Update button states
        const shuffleButtons = [
            document.getElementById('miniShuffleBtn'),
            document.getElementById('shuffleBtn')
        ];

        shuffleButtons.forEach(btn => {
            if (btn) {
                btn.classList.toggle('active', PlayerState.isShuffleOn);
            }
        });

        if (PlayerState.isShuffleOn) {
            // Create shuffled queue
            PlayerState.shuffledQueue = [...PlayerState.queue];
            for (let i = PlayerState.shuffledQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [PlayerState.shuffledQueue[i], PlayerState.shuffledQueue[j]] =
                    [PlayerState.shuffledQueue[j], PlayerState.shuffledQueue[i]];
            }
        } else {
            // Clear shuffled queue
            PlayerState.shuffledQueue = [];
        }
    },

    toggleRepeat() {
        // Cycle through repeat modes: off -> all -> once -> off
        switch (PlayerState.repeatMode) {
            case 'off':
                PlayerState.repeatMode = 'all';
                break;
            case 'all':
                PlayerState.repeatMode = 'once';
                break;
            case 'once':
                PlayerState.repeatMode = 'off';
                break;
        }

        // Update button states
        const repeatButtons = [
            document.getElementById('miniRepeatBtn'),
            document.getElementById('repeatBtn')
        ];

        repeatButtons.forEach(btn => {
            if (btn) {
                // Remove all states first
                btn.classList.remove('active', 'once');

                // Apply new states
                if (PlayerState.repeatMode === 'all') {
                    btn.classList.add('active');
                } else if (PlayerState.repeatMode === 'once') {
                    btn.classList.add('active', 'once');
                }

                // Update tooltip
                btn.title = `Repeat (${PlayerState.repeatMode})`;
            }
        });
    },

    playNext(isAuto = false) {
        // Track skip event if manually advancing (not auto-complete)
        if (!isAuto && PlayerState.currentSong && PlayerState.playStartTime) {
            const listenDuration = Math.floor((Date.now() - PlayerState.playStartTime) / 1000);
            Analytics.trackSkip(PlayerState.currentSong.url, listenDuration);
        }

        // Handle Custom Repeat
        if (isAuto && PlayerState.customRepeat.active) {
            if (PlayerState.customRepeat.count > 0) {
                PlayerState.customRepeat.count--;
                updateCustomRepeatDisplay();

                // If counts remain (after decrement), replay current song
                if (PlayerState.customRepeat.count > 0) {
                    if (PlayerState.currentSong) {
                        Player.play(
                            PlayerState.currentSong.url,
                            PlayerState.currentSong.title,
                            PlayerState.currentSong.thumbnail,
                            PlayerState.currentSong.artist
                        );
                        return;
                    }
                } else {
                    // Count reached 0 on this play completion (it was 1, now 0)
                    // The song just finished the last repeat.
                    // Disable custom repeat and proceed to next song.
                    cancelCustomRepeat();
                }
            } else {
                cancelCustomRepeat();
            }
        }

        const queue = PlayerState.isShuffleOn ? PlayerState.shuffledQueue : PlayerState.queue;
        if (queue.length === 0) return;

        // If repeat once is enabled, replay the current song (only if auto-advance)
        if (isAuto && PlayerState.repeatMode === 'once' && PlayerState.currentSong) {
            Player.play(
                PlayerState.currentSong.url,
                PlayerState.currentSong.title,
                PlayerState.currentSong.thumbnail,
                PlayerState.currentSong.artist
            );
            return;
        }

        let nextIndex = PlayerState.currentIndex + 1;
        if (nextIndex >= queue.length) {
            if (PlayerState.repeatMode === 'all') {
                nextIndex = 0;
            } else {
                // If no repeat, stop at the end of the queue
                PlayerState.isPlaying = false;
                Player.updateAllPlayButtons();
                return;
            }
        }

        PlayerState.currentIndex = nextIndex;
        const nextSong = queue[nextIndex];
        Player.play(nextSong.url, nextSong.title, nextSong.thumbnail, nextSong.artist);
    },

    playPrevious() {
        const queue = PlayerState.isShuffleOn ? PlayerState.shuffledQueue : PlayerState.queue;
        if (queue.length === 0) return;

        let prevIndex = PlayerState.currentIndex - 1;
        if (prevIndex < 0) {
            if (PlayerState.repeatMode === 'all') {
                prevIndex = queue.length - 1;
            } else {
                return;
            }
        }

        PlayerState.currentIndex = prevIndex;
        const prevSong = queue[prevIndex];
        Player.play(prevSong.url, prevSong.title, prevSong.thumbnail, prevSong.artist);
    }
};

// Library Management (unchanged except for play button handling)
const Library = {
    isLoading: true, // Add loading state
    async load(options = {}) {
        try {
            const { silent = false, retries = 0, force = false } = options;
            const url = force ? '/library/get?force=1' : '/library/get';
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                PlayerState.library = data.library || [];
                this.isLoading = false; // Data loaded

                // Update specific buttons if needed (re-check likes)
                this.updateLikeButton();

                // If we have a current song (restored from state), update its like button specifically
                // because previous updateDisplay call might have happened before library was loaded
                if (PlayerState.currentSong) {
                    this.updateLikeButton(PlayerState.currentSong.url);
                    this.updateHeaderState();
                }

                // Re-render expanded view if it's already open
                const expandedView = document.getElementById('likedSongsExpanded');
                if (expandedView && expandedView.classList.contains('show')) {
                    this.renderExtendedView();
                }

                // If server is syncing in background, re-fetch shortly to refresh UI
                if (data.syncing && retries < 3 && !force) {
                    setTimeout(() => {
                        this.load({ silent: true, retries: retries + 1, force: true });
                    }, 2000);
                }
            } else {
                console.warn('Failed to load library:', data.message);
            }
        } catch (error) {
            console.error('Error loading library:', error);
        }
    },



    toggleExtendedView() {
        const expandedView = document.getElementById('likedSongsExpanded');
        if (!expandedView) return;

        expandedView.classList.toggle('show');
        if (expandedView.classList.contains('show')) {
            this.renderExtendedView();
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        } else {
            document.body.style.overflow = '';
        }
    },

    renderExtendedView() {
        const listContainer = document.getElementById('expandedSongsList');
        const songCount = document.getElementById('expandedSongCount');

        if (!listContainer) return;

        // If loading, don't clear skeletons (which are default info in HTML)
        if (this.isLoading) {
            // Keep skeletons, maybe show count as 'Loading...'
            if (songCount) songCount.textContent = 'Loading...';
            return;
        }

        if (songCount) {
            songCount.textContent = `${PlayerState.library.length} songs`;
        }

        if (PlayerState.library.length === 0) {
            listContainer.innerHTML = '<div style="padding: 32px; text-align: center; color: #b3b3b3;">Your library is empty.</div>';
            return;
        }

        // Reverse the library array to show last added songs first
        const reversedLibrary = [...PlayerState.library].reverse();

        const sanitizeAttr = (value = '') => String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        listContainer.innerHTML = reversedLibrary.map((song, index) => {
            const sanitizedUrl = sanitizeAttr(song.url);
            const sanitizedTitle = sanitizeAttr(song.title);
            const sanitizedThumbnail = sanitizeAttr(song.thumbnail);
            const sanitizedArtist = sanitizeAttr(song.artist);

            // Generate random date/album if missing for demo/fallback 
            // (In real app, backend should provide this)
            const dateAdded = song.dateAdded ? new Date(song.dateAdded).toLocaleDateString() : 'Just now';
            const duration = song.duration || '3:45'; // Fallback
            const album = song.channel || 'Single'; // Use channel as album fallback

            // Determine if title needs marquee
            const isLongTitle = sanitizedTitle.length > 25;
            const titleHtml = isLongTitle
                ? `<div class="marquee-wrapper">
                     <div class="marquee-content">
                       <span class="row-title">${sanitizedTitle}</span>
                       <span style="display:inline-block; width: 40px;"></span>
                       <span class="row-title">${sanitizedTitle}</span>
                       <span style="display:inline-block; width: 40px;"></span>
                     </div>
                   </div>`
                : `<span class="row-title">${sanitizedTitle}</span>`;

            return `
                <div class="expanded-song-row ${PlayerState.currentSong && PlayerState.currentSong.url === song.url ? 'playing' : ''}" 
                     data-url="${sanitizedUrl}">
                    <div class="row-index">
                        <span class="index-number">${index + 1}</span>
                        <div class="playing-indicator">
                            <span class="bar"></span>
                            <span class="bar"></span>
                            <span class="bar"></span>
                            <span class="bar"></span>
                        </div>
                    </div>
                    <div class="row-title-container">
                        <img src="${sanitizedThumbnail}" class="row-thumbnail" alt="">
                        <div class="row-text">
                            ${titleHtml}
                        </div>
                    </div>
                    <div class="row-artist">${sanitizedArtist}</div>
                    <div class="row-duration">
                        <button class="remove-from-library-btn" 
                                title="Remove from Liked Songs">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    playAll() {
        if (PlayerState.isPlaying) {
            // If any song is playing, pause it
            PlaybackControls.togglePlayPause();
            return;
        }

        // If paused on library queue, resume
        if (PlayerState.queue && PlayerState.queue.type === 'library' && PlayerState.currentSong) {
            PlaybackControls.togglePlayPause();
            return;
        }

        // Restore State Logic: If we have a current song (restored) that is in the library
        // but the queue hasn't been initialized as 'library' yet
        if (PlayerState.currentSong && PlayerState.library.length > 0) {
            // Reverse library to match display order
            const reversedLibrary = [...PlayerState.library].reverse();
            const matchIndex = reversedLibrary.findIndex(s => s.url === PlayerState.currentSong.url);
            if (matchIndex !== -1) {
                // Found it! Re-initialize the queue with reversed order
                PlayerState.queue = reversedLibrary;
                PlayerState.queue.type = 'library';
                PlayerState.currentIndex = matchIndex;

                PlaybackControls.togglePlayPause();
                return;
            }
        }

        // Otherwise start from 1st (which is the last song in original order)
        if (PlayerState.library.length > 0) {
            // Reverse library to match display order
            const reversedLibrary = [...PlayerState.library].reverse();
            const firstSong = reversedLibrary[0];
            // Update queue to match reversed library order
            PlayerState.queue = reversedLibrary;
            PlayerState.queue.type = 'library';
            PlayerState.currentIndex = 0;
            Player.play(firstSong.url, firstSong.title, firstSong.thumbnail, firstSong.artist);
        }
    },

    async add(songData) {
        // Ensure consistent URL format (Server likely normalizes it)
        const cleanUrl = Player.cleanYouTubeUrl(songData.url);
        const normalizedSong = {
            ...songData,
            url: cleanUrl || songData.url
        };

        // Optimistic update: Add to library and update UI immediately
        const songWithMeta = {
            ...normalizedSong,
            dateAdded: new Date().toISOString()
        };
        PlayerState.library.push(songWithMeta);
        this.updateDisplay();
        this.updateLikeButton(normalizedSong.url);
        // Also update extended view if open
        this.renderExtendedView();

        try {
            const response = await fetch('/library/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(normalizedSong)
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to add');
            }
            // Record service activity to prevent redundant keep-alive pings
            keepAliveManager.recordServiceActivity();
        } catch (error) {
            console.error('Error adding to library:', error);
            // Revert changes on failure
            PlayerState.library = PlayerState.library.filter(s => s.url !== normalizedSong.url);
            this.updateDisplay();
            this.updateLikeButton(normalizedSong.url);
            alert('Failed to add song to library');
        }
    },

    async remove(songData) {
        // Ensure consistent URL format
        const cleanUrl = Player.cleanYouTubeUrl(songData.url);
        const normalizedSong = {
            ...songData,
            url: cleanUrl || songData.url
        };

        // Optimistic update: Remove from library and update UI immediately
        const originalLibrary = [...PlayerState.library]; // Backup for revert
        PlayerState.library = PlayerState.library.filter(song => song.url !== normalizedSong.url);
        this.updateDisplay();
        this.renderExtendedView(); // Update extended view
        this.updateLikeButton(normalizedSong.url);

        try {
            const response = await fetch('/library/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(normalizedSong)
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to remove');
            }
            // Record service activity to prevent redundant keep-alive pings
            keepAliveManager.recordServiceActivity();
        } catch (error) {
            console.error('Error removing from library:', error);
            // Revert changes on failure
            PlayerState.library = originalLibrary;
            this.updateDisplay();
            this.updateLikeButton(normalizedSong.url);
            alert('Failed to remove song from library');
        }
    },

    updateDisplay() {
        this.renderExtendedView();
    },

    updateHeaderState() {
        const headerImage = document.getElementById('likedSongsHeaderImage');
        const headerTitle = document.getElementById('likedSongsHeaderTitle');
        const expandedView = document.getElementById('likedSongsExpanded');

        if (!headerImage || !headerTitle) return;

        const currentSong = PlayerState.currentSong;

        // Determine if we should show the current song in the header
        // Show if:
        // 1. We have a current song
        // 2. That song exists in the Liked Songs library
        // 3. (Optional) We might want to ensure it's not effectively "stopped", but even paused is fine.
        let shouldShowSong = false;

        if (currentSong) {
            const isInLibrary = PlayerState.library.some(s => s.url === currentSong.url);
            // Only show if in library AND currently playing
            if (isInLibrary && PlayerState.isPlaying) {
                shouldShowSong = true;
            }
        }

        if (shouldShowSong && currentSong) {
            // Show current song info
            headerImage.innerHTML = `<img src="${currentSong.thumbnail}" alt="${currentSong.title}" style="width: 100%; height: 100%; object-fit: cover;">`;
            if (expandedView) {
                expandedView.classList.add('library-playing');
                expandedView.style.setProperty('--library-art', `url("${currentSong.thumbnail}")`);
            }

            // Truncate title to first 2 words
            const words = currentSong.title.split(' ');
            const shortTitle = words.length > 2 ? words.slice(0, 2).join(' ') : currentSong.title;
            headerTitle.textContent = shortTitle;

            // Update User to Artist and Count to Duration
            const headerUser = document.getElementById('likedSongsHeaderUser');
            const headerCount = document.getElementById('expandedSongCount');

            if (headerUser) headerUser.textContent = currentSong.artist || 'Unknown Artist';
            if (headerCount) headerCount.textContent = currentSong.duration || '3:45';

        } else {
            // Revert to default
            headerImage.innerHTML = '<i class="fas fa-heart"></i>';
            headerTitle.textContent = 'Liked Songs';
            if (expandedView) {
                expandedView.classList.remove('library-playing');
                expandedView.style.removeProperty('--library-art');
            }

            // Revert User and Count
            const headerUser = document.getElementById('likedSongsHeaderUser');
            const headerCount = document.getElementById('expandedSongCount');
            const userEmail = document.querySelector('.dropdown-header span')?.textContent || 'User';

            if (headerUser) headerUser.textContent = userEmail;
            if (headerCount) headerCount.textContent = `${PlayerState.library.length} songs`;
        }
    },





    async toggleLike(song) {
        if (!song) return;

        const isInLibrary = PlayerState.library.some(s => s.url === song.url);
        if (isInLibrary) {
            await this.remove(song);
        } else {
            await this.add(song);
        }
        this.updateLikeButton(song.url);
    },

    updateLikeButton(targetUrl = null) {
        // Helper to check library status
        const isLiked = (url) => PlayerState.library.some(s => s.url === url);

        // 1. Update Main/Mini/Expanded Player Hearts
        const playerHeart = document.getElementById('likeButtonIcon');
        const expandedHeart = document.getElementById('expandedLikeIcon');
        if (playerHeart && PlayerState.currentSong) {
            // If targetUrl is provided, only update if it matches current song
            if (!targetUrl || targetUrl === PlayerState.currentSong.url) {
                const liked = isLiked(PlayerState.currentSong.url);
                playerHeart.className = `fa-heart ${liked ? 'fas' : 'far'}`;
            }
        }
        if (expandedHeart && PlayerState.currentSong) {
            if (!targetUrl || targetUrl === PlayerState.currentSong.url) {
                const liked = isLiked(PlayerState.currentSong.url);
                expandedHeart.className = `fa-heart ${liked ? 'fas' : 'far'}`;
            }
        }

        // 2. Update List Buttons (Search, Trending, Moods)
        const songItems = document.querySelectorAll('.song-item, .expanded-song-row');
        songItems.forEach(item => {
            const url = item.dataset.url;
            if (!url) return;

            // If specific target, skip others
            if (targetUrl && url !== targetUrl) return;

            // Handle different button locations/structures
            // Standard song-item might have .add-to-library or .mini-like-btn
            const heartIcon = item.querySelector('.add-to-library i, .mini-like-btn i');
            if (heartIcon) {
                const liked = isLiked(url);
                heartIcon.className = `fa-heart ${liked ? 'fas' : 'far'}`;

                // Also update the button title if needed
                const btn = heartIcon.closest('button');
                if (btn && btn.classList.contains('add-to-library')) {
                    // Start animation if it was just liked (optional, but nice)
                    // if (targetUrl && liked) { ... } 
                }
            }
        });
    }
};

// Search Functionality (unchanged)
const Search = {
    init() {
        if (!Elements.search.input) return; // Only attach on pages with search
        Elements.search.input.addEventListener('input', debounce(this.handleSearch.bind(this), 500));
    },

    async handleSearch() {
        const query = Elements.search.input.value.trim();

        if (!query) {
            Elements.search.results.style.display = 'none';
            Elements.search.trending.style.display = 'block';
            document.getElementById('moodPlaylistsContainer').style.display = 'block';
            // Hide specific loader if it was open
            if (Elements.search.loader) Elements.search.loader.style.display = 'none';
            return;
        }

        Elements.search.trending.style.display = 'none';
        document.getElementById('moodPlaylistsContainer').style.display = 'none';

        // Show results container
        Elements.search.results.style.display = 'block';

        // Inject Skeleton Loader
        const skeletonHTML = Array(10).fill(`
            <li class="song-item skeleton">
                <div class="skeleton-img"></div>
                <div class="skeleton-text skeleton-title"></div>
                <div class="skeleton-text skeleton-artist"></div>
            </li>
        `).join('');
        Elements.search.list.innerHTML = skeletonHTML;

        // Hide circular loader if it exists
        if (Elements.search.loader) Elements.search.loader.style.display = 'none';

        try {
            const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (!response.ok) throw new Error('Search request failed');
            this.displayResults(data);
        } catch (error) {
            console.error('Search error:', error);
            Elements.search.list.innerHTML = '<li class="error-message">An error occurred while searching</li>';
        }
        // No finally block needed as displayResults or error handling will overwrite the skeleton
    },

    displayResults(results) {
        if (!Array.isArray(results) || results.length === 0) {
            Elements.search.list.innerHTML = '<li class="error-message">No results found</li>';
            return;
        }

        Elements.search.list.innerHTML = '';
        const fragment = document.createDocumentFragment();

        results.forEach(song => {
            const li = document.createElement('li');
            li.className = 'song-item';
            li.setAttribute('data-url', song.url);
            li.setAttribute('data-title', song.title);
            li.setAttribute('data-thumbnail', song.thumbnail);
            li.setAttribute('data-artist', song.artist);

            const isLiked = PlayerState.library.some(s => s.url === song.url);

            li.innerHTML = `
                <img class="song-thumbnail" src="${song.thumbnail}" alt="${song.title}" loading="lazy">
                <div class="song-info">
                    <h3></h3>
                    <p></p>
                    <div class="song-buttons">
                        <button class="play-btn">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="add-to-library" title="Save to Library">
                            <i class="fa-heart ${isLiked ? 'fas' : 'far'}"></i>
                        </button>
                    </div>
                </div>
            `;

            // Safe text insertion
            li.querySelector('h3').textContent = song.title;
            li.querySelector('p').textContent = song.artist;

            // Attach event listeners
            li.querySelector('.play-btn').onclick = (e) => {
                e.stopPropagation();
                Player.togglePlayPause(song.url, song.title, song.thumbnail, song.artist);
            };

            li.querySelector('.add-to-library').onclick = (e) => {
                e.stopPropagation();
                Library.toggleLike({
                    url: song.url,
                    title: song.title,
                    thumbnail: song.thumbnail,
                    artist: song.artist
                });
            };

            fragment.appendChild(li);
        });

        Elements.search.list.appendChild(fragment);
    }
};

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Update the volume control handling
function updateVolumeControls(volume) {
    // Clamp volume between 0 and 1 for HTML5 Audio
    const clampedVolume = Math.min(Math.max(volume, 0), 1);

    // Update audio volume
    PlayerState.volume = volume; // Keep original volume value for display
    PlayerState.audio.volume = clampedVolume; // Use clamped volume for audio

    // Update volume sliders - sync both controls
    const volumeControls = document.querySelectorAll('#miniVolumeControl, #volumeControl');
    volumeControls.forEach(control => {
        if (control) {
            control.value = volume;
            control.style.setProperty('--volume-level', `${clampedVolume * 100}%`);
        }
    });

    // Update volume icons
    updateVolumeIcons(volume);
}

function updateVolumeIcons(volume) {
    const volumeIcons = {
        mute: 'fa-volume-mute',
        low: 'fa-volume-off',    // Speaker cone only (Low)
        medium: 'fa-volume-low', // 1 wave (Medium)
        high: 'fa-volume-high'   // 2 waves (Full)
    };

    const getVolumeIcon = (vol) => {
        if (vol === 0) return volumeIcons.mute;
        if (vol < 0.33) return volumeIcons.low;
        if (vol < 0.66) return volumeIcons.medium;
        return volumeIcons.high;
    };

    const icon = getVolumeIcon(volume);
    const miniVolumeBtn = document.getElementById('miniVolumeBtn');
    const volumeBtn = document.getElementById('volumeBtn');

    // Update both buttons
    const iconHtml = `<i class="fas ${icon}"></i>`;
    if (volumeBtn) volumeBtn.innerHTML = iconHtml;
    if (miniVolumeBtn) miniVolumeBtn.innerHTML = iconHtml;
}

// Custom Repeat Functions
function toggleCustomRepeatUI() {
    const modal = document.getElementById('customRepeatModal');
    if (modal) {
        modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';

        // Reset input to 2 when opening
        if (modal.style.display === 'flex') {
            const input = document.getElementById('playCountInput');
            if (input) input.value = 2;
        }
    }
}

function adjustRepeatCount(delta) {
    const input = document.getElementById('playCountInput');
    if (input) {
        let val = parseInt(input.value) || 2;
        val += delta;
        if (val < 2) val = 2;
        if (val > 100) val = 100;
        input.value = val;
    }
}

function confirmCustomRepeat() {
    const input = document.getElementById('playCountInput');
    if (input) {
        const count = parseInt(input.value);
        if (count >= 2 && count <= 100) {
            PlayerState.customRepeat.active = true;
            PlayerState.customRepeat.count = count;

            // Update UI
            toggleCustomRepeatUI();
            updateCustomRepeatDisplay();

            // Disable standard repeat if active to avoid confusion
            if (PlayerState.repeatMode !== 'off') {
                PlaybackControls.toggleRepeat(); // Cycle until off? No, just set to off
                PlayerState.repeatMode = 'off';
                // Force update UI for repeat button
                const repeatButtons = [
                    document.getElementById('miniRepeatBtn'),
                    document.getElementById('repeatBtn')
                ];
                repeatButtons.forEach(btn => {
                    if (btn) {
                        btn.classList.remove('active', 'once');
                        btn.title = 'Repeat (off)';
                    }
                });
            }
        }
    }
}

function cancelCustomRepeat() {
    PlayerState.customRepeat.active = false;
    PlayerState.customRepeat.count = 0;
    updateCustomRepeatDisplay();
}

function updateCustomRepeatDisplay() {
    const display = document.getElementById('repeatStatusDisplay');
    const countSpan = document.getElementById('repeatsLeftCount');
    const customBtn = document.getElementById('customRepeatBtn');

    if (display && countSpan) {
        if (PlayerState.customRepeat.active && PlayerState.customRepeat.count > 0) {
            display.style.display = 'flex';
            countSpan.textContent = PlayerState.customRepeat.count;
            if (customBtn) customBtn.classList.add('active'); // Style this if needed
        } else {
            display.style.display = 'none';
            if (customBtn) customBtn.classList.remove('active');
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    Library.load();

    // Event delegation for the library list
    const expandedList = document.getElementById('expandedSongsList');
    if (expandedList) {
        expandedList.addEventListener('click', (e) => {
            const row = e.target.closest('.expanded-song-row');
            if (!row) return;

            const url = row.dataset.url;
            // Decode URL if strictly necessary, but dataset usually handles it. 
            // We match against library which we assume uses the same URL string.
            const song = PlayerState.library.find(s => s.url === url);

            if (e.target.closest('.remove-from-library-btn')) {
                e.stopPropagation();
                if (song) Library.toggleLike(song);
                return;
            }

            if (song) {
                Player.playFromLibrary(song.url, song.title, song.thumbnail, song.artist);
            }
        });
    }

    Search.init();

    // Start keep-alive manager to prevent Render cold starts
    keepAliveManager.start();

    // Setup event listeners for play controls
    ['mini', 'main'].forEach(type => {
        if (Elements.controls.play[type]) {
            Elements.controls.play[type].addEventListener('click', (e) => { e.stopPropagation(); PlaybackControls.togglePlayPause(); });
        }
        if (Elements.controls.prev[type]) {
            Elements.controls.prev[type].addEventListener('click', (e) => { e.stopPropagation(); PlaybackControls.playPrevious(); });
        }
        if (Elements.controls.next[type]) {
            Elements.controls.next[type].addEventListener('click', (e) => { e.stopPropagation(); PlaybackControls.playNext(); });
        }

        // Add shuffle and repeat handlers
        const shuffleBtn = Elements.controls.shuffle[type];
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', (e) => { e.stopPropagation(); PlaybackControls.toggleShuffle(); });
            shuffleBtn.classList.toggle('active', PlayerState.isShuffleOn);
        }

        const repeatBtn = Elements.controls.repeat[type];
        if (repeatBtn) {
            repeatBtn.addEventListener('click', (e) => { e.stopPropagation(); PlaybackControls.toggleRepeat(); });
            repeatBtn.classList.toggle('active', PlayerState.repeatMode !== 'off');
            repeatBtn.classList.toggle('once', PlayerState.repeatMode === 'once');
        }
    });

    // Unified volume control handler
    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        updateVolumeControls(newVolume);
    };

    // Setup volume controls with single handler
    document.querySelectorAll('#miniVolumeControl, #volumeControl').forEach(control => {
        if (control) {
            control.min = "0";
            control.max = "1"; // Change max to 1 instead of 2
            control.step = "0.01";
            control.value = PlayerState.volume;
            control.addEventListener('input', handleVolumeChange);
            control.addEventListener('click', (e) => e.stopPropagation());
        }
    });

    // Unified volume button handler
    const handleVolumeButtonClick = () => {
        const newVolume = PlayerState.volume === 0 ? 1 : 0;
        updateVolumeControls(newVolume);
    };

    document.querySelectorAll('#miniVolumeBtn, #volumeBtn').forEach(button => {
        if (button) {
            button.addEventListener('click', (e) => { e.stopPropagation(); handleVolumeButtonClick(); });
        }
    });

    // Initialize volume
    updateVolumeControls(PlayerState.volume);

    // Player view transitions
    if (Elements.miniPlayer) {
        Elements.miniPlayer.addEventListener('click', (e) => {
            // Avoid expanding if the user clicks controls or progress/volume areas
            const blockSelectors = '.mini-control-btn, .mini-progress-bar, .mini-progress-bar *, .mini-volume-controls, .mini-volume-controls *';
            if (e.target.closest(blockSelectors)) return;
            if (Elements.expandedPlayer) {
                Elements.expandedPlayer.classList.add('show');
                document.body.style.overflow = 'hidden';
            }
        });
    }

    if (Elements.minimizeBtn) {
        Elements.minimizeBtn.addEventListener('click', () => {
            if (Elements.expandedPlayer) Elements.expandedPlayer.classList.remove('show');
            document.body.style.overflow = '';
        });
    }

    // Unified progress bar handler (click + drag)
    const setupSeekHandler = (bar) => {
        if (!bar) return;

        const seekTo = (clientX) => {
            const rect = bar.getBoundingClientRect();
            const percentage = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
            if (PlayerState.audio && !Number.isNaN(PlayerState.audio.duration)) {
                PlayerState.audio.currentTime = percentage * PlayerState.audio.duration;
            }
        };

        let isSeeking = false;

        bar.addEventListener('pointerdown', (e) => {
            isSeeking = true;
            bar.setPointerCapture(e.pointerId);
            seekTo(e.clientX);
            e.stopPropagation();
        });

        bar.addEventListener('pointermove', (e) => {
            if (!isSeeking) return;
            seekTo(e.clientX);
            e.stopPropagation();
        });

        bar.addEventListener('pointerup', (e) => {
            isSeeking = false;
            bar.releasePointerCapture(e.pointerId);
            e.stopPropagation();
        });

        bar.addEventListener('pointercancel', (e) => {
            isSeeking = false;
            bar.releasePointerCapture(e.pointerId);
        });
    };

    document.querySelectorAll('.mini-player .progress-bar, .expanded-player .progress-bar-wrapper')
        .forEach(setupSeekHandler);

    // Trending scroll dots indicator
    const trendingList = document.getElementById('trending-list');
    const trendingDots = document.querySelectorAll('#trendingContainer .scroll-dot');
    if (trendingList && trendingDots.length) {
        const setActiveDot = (index) => {
            trendingDots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        };

        const updateDots = () => {
            const maxScroll = trendingList.scrollWidth - trendingList.clientWidth;
            if (maxScroll <= 0) {
                setActiveDot(0);
                return;
            }
            const ratio = trendingList.scrollLeft / maxScroll;
            const index = Math.min(trendingDots.length - 1, Math.floor(ratio * trendingDots.length));
            setActiveDot(index);
        };

        const scrollToDot = (index) => {
            const maxScroll = trendingList.scrollWidth - trendingList.clientWidth;
            if (maxScroll <= 0) return;
            const clampedIndex = Math.max(0, Math.min(index, trendingDots.length - 1));
            const ratio = trendingDots.length === 1 ? 0 : clampedIndex / (trendingDots.length - 1);
            const target = ratio * maxScroll;
            trendingList.scrollTo({ left: target, behavior: 'smooth' });
        };

        trendingDots.forEach((dot, index) => {
            dot.addEventListener('click', () => scrollToDot(index));
        });

        // Mouse wheel horizontal scrolling + circular wrap
        trendingList.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            const maxScroll = trendingList.scrollWidth - trendingList.clientWidth;
            if (maxScroll <= 0) return;
            const next = trendingList.scrollLeft + e.deltaY;
            if (next >= maxScroll - 2) {
                trendingList.scrollLeft = 0;
                return;
            }
            if (next <= 2) {
                trendingList.scrollLeft = maxScroll;
                return;
            }
            trendingList.scrollLeft = next;
        }, { passive: false });

        trendingList.addEventListener('scroll', updateDots, { passive: true });
        window.addEventListener('resize', updateDots);
        updateDots();
    }

    // Notification permission
    if ('Notification' in window) {
        Notification.requestPermission();
    }

    // Profile dropdown functionality
    if (Elements.profile.btn && Elements.profile.dropdown) {
        Elements.profile.btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from bubbling to document
            Elements.profile.dropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!Elements.profile.btn.contains(e.target) && !Elements.profile.dropdown.contains(e.target)) {
                Elements.profile.dropdown.classList.remove('show');
            }
        });
    }
});

// Add this function at the end of the file, just before the DOMContentLoaded event listener


// Add the showHome function
function showHome() {
    // Hide search results
    const searchResults = document.getElementById('searchResultsContainer');
    if (searchResults) {
        searchResults.style.display = 'none';
    }

    // Show trending and mood playlists
    const trendingContainer = document.getElementById('trendingContainer');
    const moodPlaylistsContainer = document.getElementById('moodPlaylistsContainer');

    if (trendingContainer) {
        trendingContainer.style.display = 'block';
    }

    if (moodPlaylistsContainer) {
        moodPlaylistsContainer.style.display = 'block';
    }

    // Clear search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }

    // Briefly highlight the home button so it remains responsive on repeated clicks
    const homeBtn = document.querySelector('.home-btn');
    if (homeBtn) {
        homeBtn.classList.add('active');
        setTimeout(() => {
            homeBtn.classList.remove('active');
        }, 200);
    }
}

// Settings Overlay Management
const Settings = {
    show() {
        const overlay = document.getElementById('settingsOverlay');
        if (overlay) {
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';

            // Close profile dropdown if open
            const profileDropdown = document.getElementById('profileDropdown');
            if (profileDropdown) {
                profileDropdown.style.display = 'none';
            }
        }
    },

    hide() {
        const overlay = document.getElementById('settingsOverlay');
        if (overlay) {
            overlay.classList.remove('show');
            document.body.style.overflow = '';
        }
    },

    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Update active nav item
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.closest('.settings-nav-item')?.classList.add('active');

        // Scroll to section
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

// Handle Escape key to close settings
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('settingsOverlay');
        if (overlay && overlay.classList.contains('show')) {
            Settings.hide();
        }
    }
});

// Close settings when clicking outside the container
document.addEventListener('click', (e) => {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay && e.target === overlay) {
        Settings.hide();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    Player.loadState();
});
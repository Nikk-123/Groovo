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
    libraryQueue: []
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
            PlayerState.audio.onended = () => PlaybackControls.playNext();
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
            Elements.display[type].thumbnail.src = thumbnail || 'default_thumbnail.jpg';
            Elements.display[type].title.textContent = title || 'Unknown Title';
            Elements.display[type].artist.textContent = artist || 'Unknown Artist';
        });
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
        document.querySelectorAll('.library-item, .song-item').forEach(item => {
            const isCurrentSong = item.dataset.url === url;
            const isPlaying = isCurrentSong && PlayerState.isPlaying;
            item.classList.toggle('playing', isPlaying);
            
            const playBtn = item.querySelector('.play-btn i');
            if (playBtn) {
                playBtn.className = `fas fa-${isPlaying ? 'pause' : 'play'}`;
            }
        });
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
    },

    playFromLibrary(url, title, thumbnail, artist) {
        // Create library queue if not already playing from library
        if (!PlayerState.libraryQueue.length) {
            const libraryItems = document.querySelectorAll('.library-item');
            PlayerState.libraryQueue = Array.from(libraryItems)
                .map(item => this.getSongDataFromElement(item))
                .filter(Boolean);
        }

        // Find the index of the clicked song in the library queue
        const songIndex = PlayerState.libraryQueue.findIndex(song => song.url === url);
        if (songIndex !== -1) {
            PlayerState.currentIndex = songIndex;
            PlayerState.queue = PlayerState.libraryQueue; // Use library as the current queue
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

    togglePlayFromLibraryElement(button) {
        if (!button) return;

        const item = button.closest('.library-item');
        const song = item ? this.getSongDataFromElement(item) : this.getSongDataFromElement(button);
        if (!song) return;

        this.togglePlayFromLibrary(song.url, song.title, song.thumbnail, song.artist);
    },

    getSongDataFromElement(element) {
        if (!element) return null;

        const encoded = element.dataset.song;
        if (encoded) {
            try {
                return JSON.parse(decodeURIComponent(encoded));
            } catch (error) {
                console.error('Unable to parse encoded song data:', error);
            }
        }

        // Fallback to individual data attributes
        const { url, title, thumbnail, artist } = element.dataset;
        if (!url) {
            return null;
        }

        return {
            url,
            title: title || 'Unknown Title',
            thumbnail: thumbnail || '',
            artist: artist || 'Unknown Artist'
        };
    }
};

// Playback Controls
const PlaybackControls = {
    togglePlayPause() {
        if (!PlayerState.currentSong) return;

        if (PlayerState.isPlaying) {
            PlayerState.audio.pause();
            PlayerState.isPlaying = false;
        } else {
            PlayerState.audio.play();
            PlayerState.isPlaying = true;
        }
        Player.updateAllPlayButtons(PlayerState.currentSong.url);
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

    playNext() {
        const queue = PlayerState.isShuffleOn ? PlayerState.shuffledQueue : PlayerState.queue;
        if (queue.length === 0) return;

        // If repeat once is enabled, replay the current song
        if (PlayerState.repeatMode === 'once' && PlayerState.currentSong) {
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
    async load() {
        try {
            const response = await fetch('/library/get');
            const data = await response.json();
            if (data.success) {
                PlayerState.library = data.library;
                this.updateDisplay();
            }
        } catch (error) {
            console.error('Error loading library:', error);
        }
    },

    async add(songData) {
        try {
            const response = await fetch('/library/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(songData)
            });
            const data = await response.json();
            if (data.success) {
                PlayerState.library.push(songData);
                this.updateDisplay();
                this.updateLikeButton(songData.url);
            }
        } catch (error) {
            console.error('Error adding to library:', error);
            alert('Failed to add song to library');
        }
    },

    async remove(songData) {
        try {
            const response = await fetch('/library/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(songData)
            });
            const data = await response.json();
            if (data.success) {
                PlayerState.library = PlayerState.library.filter(song => song.url !== songData.url);
                this.updateDisplay();
                this.updateLikeButton(songData.url);
            }
        } catch (error) {
            console.error('Error removing from library:', error);
            alert('Failed to remove song from library');
        }
    },

    updateDisplay() {
    const libraryList = document.getElementById('libraryList');
    const emptyMessage = document.getElementById('emptyLibraryMessage');

    // If the page doesn't have a library UI, skip rendering to avoid errors
    if (!libraryList || !emptyMessage) return;

        if (PlayerState.library.length === 0) {
            libraryList.style.display = 'none';
            emptyMessage.style.display = 'block';
            return;
        }

    libraryList.style.display = 'block';
    emptyMessage.style.display = 'none';
    libraryList.innerHTML = PlayerState.library.map(song => this.createSongElement(song)).join('');
    },

    createSongElement(song) {
        const sanitizeAttr = (value = '') => String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const sanitizedUrl = sanitizeAttr(song.url);
        const sanitizedTitle = sanitizeAttr(song.title);
        const sanitizedThumbnail = sanitizeAttr(song.thumbnail);
        const sanitizedArtist = sanitizeAttr(song.artist);
        const encodedSong = encodeURIComponent(JSON.stringify({
            url: song.url,
            title: song.title,
            thumbnail: song.thumbnail,
            artist: song.artist
        }));
        const sanitizedEncodedSong = sanitizeAttr(encodedSong);

        return `
            <li class="library-item" 
                data-url="${sanitizedUrl}"
                data-title="${sanitizedTitle}"
                data-thumbnail="${sanitizedThumbnail}"
                data-artist="${sanitizedArtist}"
                data-song="${sanitizedEncodedSong}">
                <img class="song-thumbnail" src="${sanitizedThumbnail}" alt="${sanitizedTitle}">
                <div class="library-item-info">
                    <h3>${sanitizedTitle}</h3>
                    <p>${sanitizedArtist}</p>
                </div>
                <div class="library-item-controls">
                    <button
                        class="play-btn"
                        data-song="${sanitizedEncodedSong}"
                        onclick="Player.togglePlayFromLibraryElement(this)"
                        title="Play/Pause"
                    >
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="remove-from-library" 
                        data-song="${sanitizedEncodedSong}"
                        onclick="Library.removeFromElement(this)">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `;
    },

    async removeFromElement(button) {
        if (!button || !button.dataset.song) return;

        try {
            const songData = JSON.parse(decodeURIComponent(button.dataset.song));
            await this.remove(songData);
        } catch (error) {
            console.error('Failed to parse song data for removal:', error);
            alert('Something went wrong while removing this song. Please try again.');
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

    updateLikeButton(songUrl) {
        const likeButton = document.getElementById('likeButtonIcon');
        if (!likeButton) return;

        const isInLibrary = PlayerState.library.some(song => song.url === songUrl);
        likeButton.className = `fa-heart ${isInLibrary ? 'fas' : 'far'}`;
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
            return;
        }

        Elements.search.trending.style.display = 'none';
        document.getElementById('moodPlaylistsContainer').style.display = 'none';
        Elements.search.loader.style.display = 'block';
        Elements.search.results.style.display = 'block';
        
        try {
            const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (!response.ok) throw new Error('Search request failed');
            this.displayResults(data);
        } catch (error) {
            console.error('Search error:', error);
            Elements.search.list.innerHTML = '<li class="error-message">An error occurred while searching</li>';
        } finally {
            Elements.search.loader.style.display = 'none';
        }
    },

    displayResults(results) {
        if (!Array.isArray(results) || results.length === 0) {
            Elements.search.list.innerHTML = '<li class="error-message">No results found</li>';
            return;
        }

        Elements.search.list.innerHTML = results.map(song => `
            <li class="song-item" 
                data-url="${song.url}"
                data-title="${song.title}"
                data-thumbnail="${song.thumbnail}"
                data-artist="${song.artist}">
                <img class="song-thumbnail" src="${song.thumbnail}" alt="${song.title}">
                <div class="song-info">
                    <h3>${song.title}</h3>
                    <p>${song.artist}</p>
                    <div class="song-buttons">
                        <button onclick="Player.togglePlayPause('${song.url}', '${song.title}', '${song.thumbnail}', '${song.artist}')" class="play-btn">
                            <i class="fas fa-play"></i>
                        </button>
                        <button 
                            class="add-to-library"
                            onclick="Library.toggleLike({url: '${song.url}', title: '${song.title}', thumbnail: '${song.thumbnail}', artist: '${song.artist}'})"
                            title="Save to Library"
                        >
                            <i class="fa-heart ${PlayerState.library.some(s => s.url === song.url) ? 'fas' : 'far'}"></i>
                        </button>
                    </div>
                </div>
            </li>
        `).join('');
    }
};

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
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
        if (control) control.value = volume;
    });

    // Update volume icons
    updateVolumeIcons(volume);
}

function updateVolumeIcons(volume) {
    const volumeIcons = {
        mute: 'fa-volume-mute',
        low: 'fa-volume-down',
        high: 'fa-volume-up'
    };

    const getVolumeIcon = (vol) => {
        if (vol === 0) return volumeIcons.mute;
        if (vol < 0.5) return volumeIcons.low;
        return volumeIcons.high;
    };

    const icon = getVolumeIcon(volume);
    const miniVolumeBtn = document.getElementById('miniVolumeBtn');
    const volumeBtn = document.getElementById('volumeBtn');
    
    if (miniVolumeBtn) miniVolumeBtn.innerHTML = `<i class="fas ${icon}"></i>`;
    if (volumeBtn) volumeBtn.innerHTML = `<i class="fas ${icon}"></i>`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    Library.load();
    Search.init();

    // Setup event listeners for play controls
    ['mini', 'main'].forEach(type => {
        if (Elements.controls.play[type]) {
            Elements.controls.play[type].addEventListener('click', (e)=>{ e.stopPropagation(); PlaybackControls.togglePlayPause(); });
        }
        if (Elements.controls.prev[type]) {
            Elements.controls.prev[type].addEventListener('click', (e)=>{ e.stopPropagation(); PlaybackControls.playPrevious(); });
        }
        if (Elements.controls.next[type]) {
            Elements.controls.next[type].addEventListener('click', (e)=>{ e.stopPropagation(); PlaybackControls.playNext(); });
        }
        
        // Add shuffle and repeat handlers
        const shuffleBtn = Elements.controls.shuffle[type];
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', (e)=>{ e.stopPropagation(); PlaybackControls.toggleShuffle(); });
            shuffleBtn.classList.toggle('active', PlayerState.isShuffleOn);
        }

        const repeatBtn = Elements.controls.repeat[type];
        if (repeatBtn) {
            repeatBtn.addEventListener('click', (e)=>{ e.stopPropagation(); PlaybackControls.toggleRepeat(); });
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
            control.addEventListener('click', (e)=> e.stopPropagation());
        }
    });

    // Unified volume button handler
    const handleVolumeButtonClick = () => {
        const newVolume = PlayerState.volume === 0 ? 1 : 0;
        updateVolumeControls(newVolume);
    };

    document.querySelectorAll('#miniVolumeBtn, #volumeBtn').forEach(button => {
        if (button) {
            button.addEventListener('click', (e)=>{ e.stopPropagation(); handleVolumeButtonClick(); });
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

    // Unified progress bar handler
    document.querySelectorAll('.mini-player .progress-bar, .expanded-player .progress-bar')
        .forEach(bar => {
            bar.addEventListener('click', (e) => {
                const rect = bar.getBoundingClientRect();
                const percentage = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
                if (PlayerState.audio && !Number.isNaN(PlayerState.audio.duration)) {
                    PlayerState.audio.currentTime = percentage * PlayerState.audio.duration;
                }
                e.stopPropagation();
            });
        });

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
function toggleLibrary() {
    const librarySection = document.getElementById('librarySection');
    if (librarySection) {
        librarySection.classList.toggle('show');
        document.body.classList.toggle('library-open');
    }
}

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

// function toggleRegisterSection() {
//     const registerSection = document.getElementById('registerSection');
//     const enableFaceAuth = document.getElementById('enableFaceAuth');
//     const statusText = document.getElementById('statusText');
  
//     if (enableFaceAuth && registerSection && statusText) {
//       const isEnabled = enableFaceAuth.checked;
//       registerSection.classList.toggle('hidden', !isEnabled);
//       statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';
//       statusText.className = `ml-4 font-semibold ${isEnabled ? 'text-green-500' : 'text-gray-500'}`;
//     } else {
//       console.error('Toggle elements not found');
//     }
//   }
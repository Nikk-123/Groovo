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
    shuffledQueue: []
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
    homeBtn: document.querySelector('.home-btn')
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
            PlayerState.audio.onloadedmetadata = () => {
                // Update duration if not provided by server
                if (!duration) duration = PlayerState.audio.duration;
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
        Elements.controls.play.mini.innerHTML = `<i class="fas ${icon}"></i>`;
        Elements.controls.play.main.innerHTML = `<i class="fas ${icon}"></i>`;
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
        return `
            <li class="library-item" 
                data-url="${song.url}"
                data-title="${song.title}"
                data-thumbnail="${song.thumbnail}"
                data-artist="${song.artist}">
                <img class="song-thumbnail" src="${song.thumbnail}" alt="${song.title}">
                <div class="library-item-info">
                    <h3>${song.title}</h3>
                    <p>${song.artist}</p>
                </div>
                <div class="library-item-controls">
                    <button onclick="Player.togglePlayPause('${song.url}', '${song.title}', '${song.thumbnail}', '${song.artist}')" class="play-btn">
                        <i class="fas ${song.url === PlayerState.currentSong?.url && PlayerState.isPlaying ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <button class="remove-from-library" 
                        onclick="Library.remove(${JSON.stringify(song)})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `;
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
                            <i class="fas fa-play"></i> Play
                        </button>
                        <button onclick="Library.add(${JSON.stringify(song)})" class="add-to-library">
                            <i class="fas fa-plus"></i> Add
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    Library.load();
    Search.init();

    // Setup event listeners
    ['mini', 'main'].forEach(type => {
        Elements.controls.play[type].addEventListener('click', PlaybackControls.togglePlayPause);
        Elements.controls.prev[type].addEventListener('click', PlaybackControls.playPrevious);
        Elements.controls.next[type].addEventListener('click', PlaybackControls.playNext);
    });

    // Volume control
    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        PlayerState.volume = newVolume;
        PlayerState.audio.volume = newVolume;
    };
    
    Elements.controls.volume.mini.addEventListener('input', handleVolumeChange);
    Elements.controls.volume.main.addEventListener('input', handleVolumeChange);

    // Player view transitions
    Elements.miniPlayer.addEventListener('click', () => {
        Elements.expandedPlayer.classList.add('show');
        document.body.style.overflow = 'hidden';
    });

    Elements.minimizeBtn.addEventListener('click', () => {
        Elements.expandedPlayer.classList.remove('show');
        document.body.style.overflow = '';
    });

    // Request notification permission
    if ('Notification' in window) {
        Notification.requestPermission();
    }

    // Add shuffle button listeners
    ['mini', 'main'].forEach(type => {
        const shuffleBtn = type === 'mini' ? 
            document.getElementById('miniShuffleBtn') : 
            document.getElementById('shuffleBtn');
        
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', PlaybackControls.toggleShuffle);
            // Set initial state
            shuffleBtn.classList.toggle('active', PlayerState.isShuffleOn);
        }
    });

    // Add repeat button listeners
    ['mini', 'main'].forEach(type => {
        const repeatBtn = type === 'mini' ? 
            document.getElementById('miniRepeatBtn') : 
            document.getElementById('repeatBtn');
        
        if (repeatBtn) {
            repeatBtn.addEventListener('click', PlaybackControls.toggleRepeat);
            // Set initial state
            repeatBtn.classList.toggle('active', PlayerState.repeatMode !== 'off');
            repeatBtn.classList.toggle('once', PlayerState.repeatMode === 'once');
        }
    });
});
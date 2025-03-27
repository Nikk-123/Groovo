// Core State Management
const PlayerState = {
    queue: [],
    currentIndex: 0,
    isPlaying: false,
    library: [],
    isShuffleOn: false,
    repeatMode: 'none',
    currentSong: null,
    volume: 1,
    audioContext: null,
    audioSource: null,
    audioBuffer: null,
    lastPlayRequest: 0,
    playCooldown: 1000,
    isProcessingPlay: false,
    retryCount: 0,
    maxRetries: 3
};

// DOM Elements
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
        
        // Validate and clean YouTube URL
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
            PlayerState.retryCount = 0; // Reset retry count for new song

            // Update state
            PlayerState.currentSong = { url: cleanUrl, title, thumbnail, artist };
            this.updateDisplay(title, artist, thumbnail);
            this.showControls(true);

            console.log('Fetching audio for URL:', cleanUrl); // Debug log

            // Fetch audio URL
            const response = await fetch('/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: cleanUrl })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Server response:', data); // Debug log

            if (!data.success || !data.audio_url) {
                throw new Error(data.error || 'Failed to get audio URL');
            }

            // Setup audio playback
            await this.setupAudioPlayback(data.audio_url);

            // Update UI
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

    cleanYouTubeUrl(url) {
        try {
            // Handle different YouTube URL formats
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
                let videoId;
                
                if (urlObj.hostname.includes('youtube.com')) {
                    videoId = urlObj.searchParams.get('v');
                } else {
                    videoId = urlObj.pathname.slice(1);
                }

                if (!videoId) {
                    console.error('No video ID found in URL:', url);
                    return null;
                }

                // Return clean YouTube URL
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
            
            console.error('Not a YouTube URL:', url);
            return null;
        } catch (error) {
            console.error('Error cleaning URL:', error);
            return null;
        }
    },

    async setupAudioPlayback(audioUrl) {
        try {
            // Stop current playback
            if (PlayerState.audioSource) {
                PlayerState.audioSource.stop();
                PlayerState.audioSource = null;
            }

            // Create new audio context if needed
            if (!PlayerState.audioContext) {
                PlayerState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Fetch and decode audio
            const response = await fetch(audioUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            PlayerState.audioBuffer = await PlayerState.audioContext.decodeAudioData(arrayBuffer);

            // Create and configure audio source
            PlayerState.audioSource = PlayerState.audioContext.createBufferSource();
            PlayerState.audioSource.buffer = PlayerState.audioBuffer;
            PlayerState.audioSource.connect(PlayerState.audioContext.destination);
            PlayerState.audioSource.volume = PlayerState.volume;

            // Setup event handlers
            PlayerState.audioSource.onended = () => PlaybackControls.playNext();
            PlayerState.audioSource.onerror = (error) => {
                console.error('Audio source error:', error);
                this.handlePlaybackError();
            };

            // Start playback
            PlayerState.audioSource.start(0);
            PlayerState.isPlaying = true;

        } catch (error) {
            console.error('Error setting up audio playback:', error);
            throw error;
        }
    },

    updateDisplay(title, artist, thumbnail) {
        ['mini', 'main'].forEach(type => {
            Elements.display[type].thumbnail.src = thumbnail;
            Elements.display[type].title.textContent = title;
            Elements.display[type].artist.textContent = artist;
        });
    },

    showControls(show) {
        const display = show ? 'block' : 'none';
        document.getElementById('audioControlContainer').style.display = display;
        Elements.miniPlayer.style.display = show ? 'flex' : 'none';
    },

    updateUIState(url) {
        // Update library items
        document.querySelectorAll('.library-item').forEach(item => {
            const isPlaying = item.dataset.url === url && PlayerState.isPlaying;
            item.classList.toggle('playing', isPlaying);
            const playBtn = item.querySelector('.play-btn i');
            if (playBtn) {
                playBtn.className = `fas fa-${isPlaying ? 'pause' : 'play'}`;
            }
        });

        // Update song items
        document.querySelectorAll('.song-item').forEach(item => {
            const isPlaying = item.dataset.url === url && PlayerState.isPlaying;
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
                    artwork: thumbnail ? [{ src: thumbnail }] : []
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
        if (!PlayerState.isPlaying) {
            PlayerState.retryCount++;
            
            if (PlayerState.retryCount < PlayerState.maxRetries) {
                console.log(`Retrying playback (attempt ${PlayerState.retryCount}/${PlayerState.maxRetries})...`);
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                if (PlayerState.currentSong) {
                    try {
                        await this.play(
                            PlayerState.currentSong.url,
                            PlayerState.currentSong.title,
                            PlayerState.currentSong.thumbnail,
                            PlayerState.currentSong.artist
                        );
                        return; // If successful, return early
                    } catch (retryError) {
                        console.error('Retry failed:', retryError);
                    }
                }
            }

            // If we've exhausted retries or retry failed
            alert('Failed to play the song. Please try another one.');
            this.showControls(false);
            PlayerState.isPlaying = false;
            this.updateAllPlayButtons(PlayerState.currentSong?.url);
            PlayerState.currentSong = null;
        }
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
        if (!PlayerState.audioSource) return;

        if (PlayerState.isPlaying) {
            PlayerState.audioSource.stop();
            PlayerState.isPlaying = false;
        } else {
            PlayerState.audioSource.start(0);
            PlayerState.isPlaying = true;
        }
        Player.updateAllPlayButtons(PlayerState.currentSong?.url);
    },

    playNext() {
        if (PlayerState.queue.length === 0) return;

        let nextIndex = PlayerState.currentIndex + 1;
        if (nextIndex >= PlayerState.queue.length) {
            if (PlayerState.repeatMode === 'all') {
                nextIndex = 0;
            } else {
                return;
            }
        }

        const nextSong = PlayerState.queue[nextIndex];
        Player.play(nextSong.url, nextSong.title, nextSong.thumbnail, nextSong.artist);
    },

    playPrevious() {
        if (PlayerState.queue.length === 0) return;

        let prevIndex = PlayerState.currentIndex - 1;
        if (prevIndex < 0) {
            if (PlayerState.repeatMode === 'all') {
                prevIndex = PlayerState.queue.length - 1;
            } else {
                return;
            }
        }

        const prevSong = PlayerState.queue[prevIndex];
        Player.play(prevSong.url, prevSong.title, prevSong.thumbnail, prevSong.artist);
    }
};

// Library Management
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
                alert('Song added to library!');
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
                alert('Song removed from library!');
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
                    <button onclick="Player.play('${song.url}', '${song.title}', '${song.thumbnail}', '${song.artist}')" class="play-btn">
                        <i class="fas ${song.url === PlayerState.currentSong?.url && PlayerState.isPlaying ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <button class="remove-from-library" 
                        onclick="Library.remove(${JSON.stringify(song)})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `;
    }
};

// Search Functionality
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
                        <button onclick="Player.play('${song.url}', '${song.title}', '${song.thumbnail}', '${song.artist}')" class="play-btn">
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
        if (PlayerState.audioSource) {
            PlayerState.audioSource.volume = newVolume;
        }
    };
    
    Elements.controls.volume.mini.addEventListener('input', handleVolumeChange);
    Elements.controls.volume.main.addEventListener('input', handleVolumeChange);

    // Player view transitions
    Elements.miniPlayerContent.addEventListener('click', () => {
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
});

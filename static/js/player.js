// State Management
const PlayerState = {
    queue: [],
    currentIndex: 0,
    isPlaying: false,
    library: [],
    isShuffleOn: false,
    repeatMode: 'none', // 'none', 'all', 'one'
    originalPlaylist: [],
    originalQueue: [],
    currentSource: '', // 'search', 'library', 'trending', or 'mood'
    currentMood: '', // For mood playlists
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
    progress: {
        mini: {
            bar: document.querySelector('.mini-player .progress'),
            current: document.querySelector('.mini-player .current-time'),
            total: document.querySelector('.mini-player .total-time')
        },
        main: {
            bar: document.querySelector('.expanded-player .progress'),
            current: document.querySelector('.expanded-player .current-time'),
            total: document.querySelector('.expanded-player .total-time')
        }
    },
    display: {
        mini: {
            thumbnail: document.getElementById('miniThumbnail'),
            title: document.getElementById('miniSongTitle'),
            artist: document.getElementById('miniArtist'),
            device: document.getElementById('miniDeviceName')
        },
        main: {
            thumbnail: document.getElementById('currentThumbnail'),
            title: document.getElementById('currentSongTitle'),
            artist: document.getElementById('currentArtist'),
            device: document.getElementById('expandedDeviceName')
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
    miniPlayerContent: document.querySelector('.mini-player-content'),
    minimizeBtn: document.querySelector('.minimize-btn')
};

// Player Core Functions
const Player = {
    async play(url, title, thumbnail, artist, source = 'trending', mood = '') {
        try {
            // Update the source before playing
            PlayerState.currentSource = source;
            PlayerState.currentMood = mood;
            
            this.showControls(true);
            
            if (!url) {
                throw new Error('No URL provided');
            }

            const response = await fetch('/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to get audio URL');
            }

            // Use the metadata from the response if available, otherwise use the passed values
            const songTitle = data.title || title;
            const songThumbnail = data.thumbnail || thumbnail;
            const songArtist = data.artist || artist;

            // Update display before attempting to play
            this.updateDisplay(songTitle, songArtist, songThumbnail);
            
            // Set audio source and start playback
            await this.setAudioSource(data.audio_url);
            
            // Update queue and metadata after successful playback start
            const libraryItem = document.querySelector(`.library-item[data-url="${url}"]`);
            if (libraryItem) {
                PlayerState.currentSource = 'library';
                const librarySongs = Array.from(document.querySelectorAll('.library-item')).map(item => ({
                    url: item.dataset.url,
                    title: item.dataset.title,
                    thumbnail: item.dataset.thumbnail,
                    artist: item.dataset.artist
                }));
                PlayerState.queue = PlayerState.isShuffleOn ? 
                    this.shuffleLibraryQueue(librarySongs, url) : 
                    librarySongs;
                PlayerState.currentIndex = PlayerState.queue.findIndex(song => song.url === url);
            } else {
                PlayerState.currentSource = 'playlist';
                this.updateQueue(url, songTitle, songThumbnail, songArtist);
            }

            // Update metadata after successful playback
            this.updateMetadata(songTitle, songArtist, songThumbnail);

            // Remove playing class from all library items
            document.querySelectorAll('.library-item').forEach(item => {
                item.classList.remove('playing');
            });

            // Add playing class to current item
            const currentItem = document.querySelector(`.library-item[data-url="${url}"]`);
            if (currentItem) {
                currentItem.classList.add('playing');
                // Update play button icon to pause
                const playBtn = currentItem.querySelector('.play-btn i');
                if (playBtn) {
                    playBtn.classList.remove('fa-play');
                    playBtn.classList.add('fa-pause');
                }
            }

            // Update the now playing text
            this.updateNowPlayingSource();

        } catch (error) {
            console.error('Error playing song:', error);
            alert('Failed to play the song. Please try another one.');
            this.showControls(false);
            throw error;
        }
    },

    async setAudioSource(audioUrl) {
        try {
            if (!audioUrl) {
                throw new Error('No audio URL provided');
            }

            console.log('Setting up audio source...');
            
            // Reset audio element
            Elements.audio.pause();
            Elements.audio.currentTime = 0;
            Elements.audio.src = '';
            
            // Set new source directly
            Elements.audio.src = audioUrl;
            
            // Force load the audio
            await Elements.audio.load();
            
            console.log('Attempting to play audio...');
            const playPromise = Elements.audio.play();

            if (playPromise !== undefined) {
                await playPromise;
                console.log('Audio playback started successfully');
                PlayerState.isPlaying = true;
                this.updatePlayPauseButtons();
            }
        } catch (error) {
            console.error('Playback failed:', error);
            console.error('Audio URL:', audioUrl);
            PlayerState.isPlaying = false;
            this.updatePlayPauseButtons();
            alert('Audio playback error: Format error. Failed to play the song. Please try another one.');
            throw new Error(`Playback failed: ${error.message}`);
        }
    },

    updateQueue(url, title, thumbnail, artist) {
        if (!PlayerState.queue.find(song => song.url === url)) {
            PlayerState.queue.push({ url, title, thumbnail, artist });
            PlayerState.currentIndex = PlayerState.queue.length - 1;
        }
    },

    showControls(show) {
        const display = show ? 'block' : 'none';
        document.getElementById('audioControlContainer').style.display = display;
        Elements.miniPlayer.style.display = show ? 'flex' : 'none';
    },

    updateDisplay(title, artist, thumbnail) {
        ['mini', 'main'].forEach(type => {
            Elements.display[type].thumbnail.src = thumbnail;
            Elements.display[type].title.textContent = title;
            Elements.display[type].artist.textContent = artist;
        });
    },

    updateMetadata(title, artist, thumbnail) {
        try {
            document.title = `${title} - ${artist}`;
            if ('mediaSession' in navigator && thumbnail) {  // Only set metadata if thumbnail exists
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: title || 'Unknown Title',
                    artist: artist || 'Unknown Artist',
                    artwork: thumbnail ? [{ src: thumbnail }] : []  // Only add artwork if thumbnail exists
                });

                // Add media session action handlers
                navigator.mediaSession.setActionHandler('play', () => PlaybackControls.togglePlayPause());
                navigator.mediaSession.setActionHandler('pause', () => PlaybackControls.togglePlayPause());
                navigator.mediaSession.setActionHandler('previoustrack', () => PlaybackControls.playPrevious());
                navigator.mediaSession.setActionHandler('nexttrack', () => PlaybackControls.playNext());
            }
        } catch (error) {
            console.warn('MediaMetadata error:', error);
            // Continue playback even if metadata fails
        }
    },

    updatePlayPauseButtons() {
        const icon = PlayerState.isPlaying ? 'fa-pause' : 'fa-play';
        Elements.controls.play.mini.innerHTML = `<i class="fas ${icon}"></i>`;
        Elements.controls.play.main.innerHTML = `<i class="fas ${icon}"></i>`;
    },

    showNotification(title, artist, thumbnail) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Now Playing', {
                body: `${title} - ${artist}`,
                icon: thumbnail
            });
        }
    },

    shuffleLibraryQueue(songs, currentUrl) {
        // Keep current song, shuffle the rest
        const currentSong = songs.find(song => song.url === currentUrl);
        const otherSongs = songs.filter(song => song.url !== currentUrl);
        PlaybackModes.shuffleQueue(otherSongs);
        return [currentSong, ...otherSongs];
    },

    updateNowPlayingSource() {
        const sourceText = document.querySelector('.now-playing-text');
        if (sourceText) {
            let displayText = 'Now Playing from ';
            switch (PlayerState.currentSource) {
                case 'search':
                    displayText += 'Search';
                    break;
                case 'library':
                    displayText += 'Your Library';
                    break;
                case 'trending':
                    displayText += 'Trending';
                    break;
                case 'mood':
                    displayText += `${PlayerState.currentMood} Mood`;
                    break;
                default:
                    displayText = 'Now Playing';
            }
            sourceText.textContent = displayText;
        }
    }
};

// Playback Control Functions
const PlaybackControls = {
    togglePlayPause() {
        if (Elements.audio.paused) {
            Elements.audio.play();
            PlayerState.isPlaying = true;
    } else {
            Elements.audio.pause();
            PlayerState.isPlaying = false;
    }
        Player.updatePlayPauseButtons();
    },

    playNext() {
        if (PlayerState.queue.length === 0) {
            // If queue is empty, try to get songs from library
            const librarySongs = Array.from(document.querySelectorAll('.library-item')).map(item => ({
                url: item.dataset.url,
                title: item.dataset.title,
                thumbnail: item.dataset.thumbnail,
                artist: item.dataset.artist
            }));
            
            if (librarySongs.length > 0) {
                PlayerState.queue = librarySongs;
                PlayerState.currentSource = 'library';
            } else {
        return;
    }
        }

        let nextIndex = PlayerState.currentIndex + 1;
        
        if (nextIndex >= PlayerState.queue.length) {
            if (PlayerState.repeatMode === 'all') {
                nextIndex = 0;
            } else {
        return;
    }
        }

        PlayerState.currentIndex = nextIndex;
        const nextSong = PlayerState.queue[nextIndex];
        
        // Log the next song for debugging
        console.log('Playing next song:', nextSong);
        
        // Ensure all required properties exist before playing
        if (nextSong && nextSong.url) {
            Player.play(
                nextSong.url,
                nextSong.title || 'Unknown Title',
                nextSong.thumbnail || '',
                nextSong.artist || 'Unknown Artist'
            );
        } else {
            console.error('Invalid song data:', nextSong);
        }
    },

    playPrevious() {
        if (PlayerState.queue.length === 0) {
            // If queue is empty, try to get songs from library
            const librarySongs = Array.from(document.querySelectorAll('.library-item')).map(item => ({
                url: item.dataset.url,
                title: item.dataset.title,
                thumbnail: item.dataset.thumbnail,
                artist: item.dataset.artist
            }));
            
            if (librarySongs.length > 0) {
                PlayerState.queue = librarySongs;
                PlayerState.currentSource = 'library';
    } else {
                return;
            }
    }

        if (Elements.audio.currentTime > 3) {
            Elements.audio.currentTime = 0;
            return;
}

        let prevIndex = PlayerState.currentIndex - 1;
    
        if (prevIndex < 0) {
            if (PlayerState.repeatMode === 'all') {
                prevIndex = PlayerState.queue.length - 1;
    } else {
                return;
            }
        }

        PlayerState.currentIndex = prevIndex;
        const prevSong = PlayerState.queue[prevIndex];
        
        // Ensure all required properties exist before playing
        if (prevSong && prevSong.url) {
            Player.play(
                prevSong.url,
                prevSong.title || 'Unknown Title',
                prevSong.thumbnail || '',
                prevSong.artist || 'Unknown Artist'
            );
        } else {
            console.error('Invalid song data:', prevSong);
        }
    }
};

// Library Management
const Library = {
    load() {
        fetch('/library/get')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.library.length > 0) {
                    document.getElementById('libraryList').style.display = 'block';
                    document.getElementById('emptyLibraryMessage').style.display = 'none';
                } else {
                    document.getElementById('libraryList').style.display = 'none';
                    document.getElementById('emptyLibraryMessage').style.display = 'block';
                }
            })
            .catch(error => console.error('Error loading library:', error));
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
            <li class="library-item" data-url="${song.url}">
                <img class="song-thumbnail" src="${song.thumbnail}" alt="${song.title}">
                <div class="library-item-info">
                    <h3>${song.title}</h3>
                    <p>${song.artist}</p>
                </div>
                <div class="library-item-controls">
                    <button onclick="Player.play('${song.url}', '${song.title}', '${song.thumbnail}', '${song.artist}')" class="play-btn">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="remove-from-library" onclick='Library.remove(${JSON.stringify(song)})'>
                        <i class="fas fa-minus"></i> Remove
                    </button>
                </div>
            </li>
        `;
    }
};

// Search Functionality
const Search = {
    init() {
        Elements.search.input.addEventListener('input', debounce(this.handleSearch, 500));
    },

    async handleSearch() {
        const query = Elements.search.input.value.trim();
        if (!query) {
            Elements.search.results.style.display = 'none';
            Elements.search.trending.style.display = 'block';
            return;
        }
        
        Elements.search.loader.style.display = 'block';
        try {
            const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            Search.displayResults(data);
        } catch (error) {
            console.error('Search error:', error);
            Elements.search.list.innerHTML = '<li class="error-message">An error occurred while searching</li>';
        } finally {
            Elements.search.loader.style.display = 'none';
        }
    },

    displayResults(results) {
        // Implementation of search results display
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

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Add this new object for progress bar functionality
const ProgressBar = {
    isDragging: false,
    
    init() {
        // Add event listeners for both progress bars
        ['mini', 'main'].forEach(type => {
            const progressBar = Elements.progressBars[type];
            if (!progressBar) return; // Skip if element not found
            
            // Click handling
            progressBar.addEventListener('click', (e) => this.handleProgressClick(e));
            
            // Drag handling
            progressBar.addEventListener('mousedown', (e) => this.handleDragStart(e));
            
            // Touch handling for mobile
            progressBar.addEventListener('touchstart', (e) => this.handleDragStart(e), { passive: true });
        });

        // Add global mouse/touch move and end listeners
        document.addEventListener('mousemove', (e) => this.handleDragMove(e));
        document.addEventListener('mouseup', (e) => this.handleDragEnd(e));
        document.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: true });
        document.addEventListener('touchend', (e) => this.handleDragEnd(e));
    },

    handleProgressClick(e) {
        e.stopPropagation(); // Prevent click from bubbling to mini-player
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        const newTime = clickPosition * Elements.audio.duration;
        
        if (isFinite(newTime)) {
            Elements.audio.currentTime = newTime;
            this.updateProgress(newTime);
        }
    },

    handleDragStart(e) {
        e.stopPropagation(); // Prevent drag from bubbling to mini-player
        this.isDragging = true;
        const progressBar = e.currentTarget;
        progressBar.style.cursor = 'grabbing';
    },

    handleDragMove(e) {
        if (!this.isDragging) return;
        
        const progressBar = e.target.closest('.progress-bar');
        if (!progressBar) return;
        
        const rect = progressBar.getBoundingClientRect();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let clickPosition = (clientX - rect.left) / rect.width;
        
        // Clamp the position between 0 and 1
        clickPosition = Math.max(0, Math.min(1, clickPosition));
        
        const newTime = clickPosition * Elements.audio.duration;
        if (isFinite(newTime)) {
            Elements.audio.currentTime = newTime;
            this.updateProgress(newTime);
        }
    },

    handleDragEnd(e) {
        if (!this.isDragging) return;
        
        const progressBar = e.target.closest('.progress-bar');
        if (progressBar) {
            progressBar.style.cursor = 'pointer';
            
            const rect = progressBar.getBoundingClientRect();
            const clientX = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
            let clickPosition = (clientX - rect.left) / rect.width;
            
            // Clamp the position between 0 and 1
            clickPosition = Math.max(0, Math.min(1, clickPosition));
            
            const newTime = clickPosition * Elements.audio.duration;
            if (isFinite(newTime)) {
                Elements.audio.currentTime = newTime;
            }
        }
        
        this.isDragging = false;
    },

    updateProgress(currentTime) {
        if (this.isDragging) return;
        
        const duration = Elements.audio.duration;
        if (!isFinite(duration)) return;
        
        const progress = (currentTime / duration) * 100;
        
        // Update progress bars
        Elements.progress.mini.bar.style.width = `${progress}%`;
        Elements.progress.main.bar.style.width = `${progress}%`;
        
        // Update time displays
        Elements.progress.mini.current.textContent = formatTime(currentTime);
        Elements.progress.main.current.textContent = formatTime(currentTime);
        Elements.progress.mini.total.textContent = formatTime(duration);
        Elements.progress.main.total.textContent = formatTime(duration);
    }
};

// Add this new object for managing playback modes
const PlaybackModes = {
    toggleShuffle() {
        PlayerState.isShuffleOn = !PlayerState.isShuffleOn;
        
        // Get the current queue based on source
        let currentQueue = [];
        
        if (PlayerState.currentSource === 'library') {
            // Get songs from library with all metadata
            currentQueue = Array.from(document.querySelectorAll('.library-item')).map(item => ({
                url: item.dataset.url,
                title: item.dataset.title,
                thumbnail: item.dataset.thumbnail,
                artist: item.dataset.artist
            }));
        } else {
            currentQueue = [...PlayerState.queue];
        }

        // Ensure we have a valid queue
        if (!currentQueue || currentQueue.length === 0) {
            console.warn('No songs in queue to shuffle');
            return;
        }

        if (PlayerState.isShuffleOn) {
            // Store original queue
            PlayerState.originalQueue = [...currentQueue];
            
            // Get current song with all its metadata
            const currentSong = currentQueue[PlayerState.currentIndex];
            
            // Remove current song from the array before shuffling
            const remainingSongs = currentQueue.filter(song => song.url !== currentSong.url);
            
            // Shuffle remaining songs
            this.shuffleQueue(remainingSongs);
            
            // Put current song at the beginning and add shuffled songs after
            PlayerState.queue = [currentSong, ...remainingSongs];
            PlayerState.currentIndex = 0;
        } else {
            // Restore original order
            PlayerState.queue = [...PlayerState.originalQueue];
            
            // Find current song in original queue
            const currentSong = PlayerState.queue[PlayerState.currentIndex];
            PlayerState.currentIndex = PlayerState.originalQueue.findIndex(song => song.url === currentSong.url);
        }
        
        this.updateShuffleButtons();
        console.log('Current queue after shuffle:', PlayerState.queue); // Debug log
    },

    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(PlayerState.repeatMode);
        PlayerState.repeatMode = modes[(currentIndex + 1) % modes.length];
        this.updateRepeatButtons();
    },

    shuffleQueue(queue) {
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }
    },

    updateShuffleButtons() {
        const shuffleClass = PlayerState.isShuffleOn ? 'active' : '';
        Elements.controls.shuffle.mini.classList.toggle('active', PlayerState.isShuffleOn);
        Elements.controls.shuffle.main.classList.toggle('active', PlayerState.isShuffleOn);
    },

    updateRepeatButtons() {
        ['mini', 'main'].forEach(type => {
            const btn = Elements.controls.repeat[type];
            btn.classList.remove('active', 'one');
            
            switch (PlayerState.repeatMode) {
                case 'all':
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fas fa-redo"></i>';
                    break;
                case 'one':
                    btn.classList.add('active', 'one');
                    btn.innerHTML = '<i class="fas fa-redo-alt"></i>';
                    break;
                default:
                    btn.innerHTML = '<i class="fas fa-redo"></i>';
            }
        });
    }
};

// Add this new object to handle player view transitions
const PlayerView = {
    expand() {
        Elements.expandedPlayer.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    minimize() {
        Elements.expandedPlayer.classList.remove('show');
        document.body.style.overflow = '';
    },

    init() {
        // Open expanded view when clicking mini player (except controls)
        Elements.miniPlayerContent.addEventListener('click', (e) => {
            // List of elements/classes that should not trigger expansion
            const excludedElements = [
                '.mini-control-buttons',
                '.mini-like-btn',
                '.volume-control',
                '.progress-bar',
                '#miniPlayBtn',
                '#miniPrevBtn',
                '#miniNextBtn',
                '#miniShuffleBtn',
                '#miniRepeatBtn',
                '#miniVolumeBtn',
                '#miniVolumeControl',
                '.mini-progress-container'
            ];

            // Check if the clicked element or its parents match any excluded elements
            const isExcluded = excludedElements.some(selector => 
                e.target.closest(selector) !== null
            );

            if (!isExcluded) {
                this.expand();
            }
        });

        // Minimize when clicking the minimize button
        Elements.minimizeBtn.addEventListener('click', () => this.minimize());
    }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    Library.load();
    Search.init();
    
    // Setup event listeners
    Elements.controls.play.mini.addEventListener('click', PlaybackControls.togglePlayPause);
    Elements.controls.play.main.addEventListener('click', PlaybackControls.togglePlayPause);
    Elements.controls.prev.mini.addEventListener('click', PlaybackControls.playPrevious);
    Elements.controls.prev.main.addEventListener('click', PlaybackControls.playPrevious);
    Elements.controls.next.mini.addEventListener('click', PlaybackControls.playNext);
    Elements.controls.next.main.addEventListener('click', PlaybackControls.playNext);
    
    // Volume control sync
    Elements.controls.volume.mini.addEventListener('input', e => Elements.audio.volume = e.target.value);
    Elements.controls.volume.main.addEventListener('input', e => Elements.audio.volume = e.target.value);
    
    // Audio player events
    Elements.audio.addEventListener('timeupdate', () => {
        ProgressBar.updateProgress(Elements.audio.currentTime);
    });
    
    Elements.audio.addEventListener('ended', PlaybackControls.playNext);

    // Request notification permission
    if ('Notification' in window) {
        Notification.requestPermission();
    }

    // Add error event listener to audio element
    Elements.audio.addEventListener('error', (e) => {
        console.error('Audio element error:', e);
        console.error('Audio error code:', Elements.audio.error.code);
        console.error('Audio error message:', Elements.audio.error.message);
        PlayerState.isPlaying = false;
        Player.updatePlayPauseButtons();
        Player.showControls(false);
        alert(`Audio playback error: ${Elements.audio.error.message}`);
    });

    // Initialize progress bar functionality
    ProgressBar.init();

    // Add shuffle and repeat button listeners
    Elements.controls.shuffle.mini.addEventListener('click', () => PlaybackModes.toggleShuffle());
    Elements.controls.shuffle.main.addEventListener('click', () => PlaybackModes.toggleShuffle());
    Elements.controls.repeat.mini.addEventListener('click', () => PlaybackModes.toggleRepeat());
    Elements.controls.repeat.main.addEventListener('click', () => PlaybackModes.toggleRepeat());
    
    // Initialize button states
    PlaybackModes.updateShuffleButtons();
    PlaybackModes.updateRepeatButtons();

    // Initialize player view
    PlayerView.init();
});

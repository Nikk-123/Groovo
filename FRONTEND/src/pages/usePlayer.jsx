import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const usePlayer = () => {
  const API_URL = 'https://spotify-3-0-es19.onrender.com';
  const audioRef = useRef(new Audio());

  const [playerState, setPlayerState] = useState({
    queue: [],
    currentIndex: 0,
    isPlaying: false,
    library: [],
    isShuffleOn: false,
    repeatMode: 'off',
    currentSong: null,
    volume: 1.0,
    lastPlayRequest: 0,
    playCooldown: 1000,
    isProcessingPlay: false,
    retryCount: 0,
    maxRetries: 3,
    shuffledQueue: [],
    libraryQueue: [],
    showExpanded: false, // Added for potential expanded player toggle
  });

  // Core Player Functions
  const player = {
    async play(url, title, thumbnail, artist) {
      if (!url) return;

      const cleanUrl = this.cleanYouTubeUrl(url);
      if (!cleanUrl) {
        console.error('Invalid YouTube URL:', url);
        alert('Invalid YouTube URL. Please try another song.');
        return;
      }

      const now = Date.now();
      if (now - playerState.lastPlayRequest < playerState.playCooldown || playerState.isProcessingPlay) {
        return;
      }

      try {
        setPlayerState(prev => ({
          ...prev,
          isProcessingPlay: true,
          lastPlayRequest: now,
          retryCount: 0,
        }));

        const newSong = { url: cleanUrl, title, thumbnail, artist };
        setPlayerState(prev => ({
          ...prev,
          currentSong: newSong,
        }));

        const response = await axios.post(
          `https://spotify-3-0-es19.onrender.com/api/play`,
          { url: cleanUrl },
          {
            withCredentials: true,
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
            responseType: 'blob', // Expect a stream
          }
        );

        const audioBlob = response.data;
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('Generated blob URL:', audioUrl);
        await this.setupAudioPlayback(audioUrl, 0); // Duration not available in stream
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
        this.updateMetadata(title, artist, thumbnail);

        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to get audio URL');
        }

        if (!response.data.audio_url) {
          throw new Error('No audio URL received from server');
        }

        await this.setupAudioPlayback(response.data.audio_url, response.data.duration);
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
        this.updateMetadata(title, artist, thumbnail);
      } catch (error) {
        console.error('Error playing song:', error);
        if (error.response?.status === 401) {
          // Handle unauthorized error
          window.location.href = '/login';
          return;
        }

        // Handle specific error messages from the server
        const errorMessage = error.response?.data?.error || error.message || 'Failed to play the song';
        alert(`Error: ${errorMessage}`);

        await this.handlePlaybackError();
      } finally {
        setPlayerState(prev => ({ ...prev, isProcessingPlay: false }));
      }
    },

    async togglePlayPause(url, title, thumbnail, artist) {
      if (playerState.currentSong && playerState.currentSong.url === url) {
        playbackControls.togglePlayPause();
      } else {
        await this.play(url, title, thumbnail, artist);
      }
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
        const audio = audioRef.current;
        audio.pause();
        audio.src = audioUrl;
        audio.volume = playerState.volume;

        // Add error handling for audio element
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          this.handlePlaybackError();
        };

        audio.onended = () => playbackControls.playNext();
        audio.ontimeupdate = () => {
          const currentTime = audio.currentTime;
          const duration = audio.duration;
          if (!duration) return;

          const progressPercentage = (currentTime / duration) * 100;
          document.querySelectorAll('.mini-player .progress').forEach(el => {
            el.style.width = `${progressPercentage}%`;
          });

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

        // Add a timeout for audio loading
        const loadTimeout = setTimeout(() => {
          if (audio.readyState === 0) {
            console.error('Audio loading timeout');
            this.handlePlaybackError();
          }
        }, 10000);

        try {
          await audio.play();
          clearTimeout(loadTimeout);
        } catch (playError) {
          console.error('Error playing audio:', playError);
          clearTimeout(loadTimeout);
          this.handlePlaybackError();
        }
      } catch (error) {
        console.error('Error setting up audio playback:', error);
        this.handlePlaybackError();
      }
    },

    async handlePlaybackError() {
      if (!playerState.isPlaying && playerState.retryCount < playerState.maxRetries) {
        setPlayerState(prev => ({
          ...prev,
          retryCount: prev.retryCount + 1,
        }));

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (playerState.currentSong) {
          try {
            await this.play(
              playerState.currentSong.url,
              playerState.currentSong.title,
              playerState.currentSong.thumbnail,
              playerState.currentSong.artist
            );
            return;
          } catch (error) {
            console.error('Retry failed:', error);
          }
        }
      }

      alert('Failed to play the song after retries. Please try another one.');
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false,
        currentSong: null,
        retryCount: 0,
      }));
    },

    playFromLibrary(url, title, thumbnail, artist) {
      if (!playerState.libraryQueue.length) {
        const newQueue = playerState.library.map(song => ({
          url: song.url,
          title: song.title,
          thumbnail: song.thumbnail,
          artist: song.artist,
        }));
        setPlayerState(prev => ({
          ...prev,
          libraryQueue: newQueue,
        }));
      }

      const songIndex = playerState.libraryQueue.findIndex(song => song.url === url);
      if (songIndex !== -1) {
        setPlayerState(prev => ({
          ...prev,
          currentIndex: songIndex,
          queue: prev.libraryQueue,
        }));
      }

      this.play(url, title, thumbnail, artist);
    },

    togglePlayFromLibrary(url, title, thumbnail, artist) {
      if (playerState.currentSong && playerState.currentSong.url === url) {
        playbackControls.togglePlayPause();
      } else {
        this.playFromLibrary(url, title, thumbnail, artist);
      }
    },

    updateMetadata(title, artist, thumbnail) {
      try {
        document.title = `${title} - ${artist}`;
        if ('mediaSession' in navigator && thumbnail) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: title || 'Unknown Title',
            artist: artist || 'Unknown Artist',
            artwork: thumbnail ? [{ src: thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
          });

          navigator.mediaSession.setActionHandler('play', () => playbackControls.togglePlayPause());
          navigator.mediaSession.setActionHandler('pause', () => playbackControls.togglePlayPause());
          navigator.mediaSession.setActionHandler('previoustrack', () => playbackControls.playPrevious());
          navigator.mediaSession.setActionHandler('nexttrack', () => playbackControls.playNext());
        }
      } catch (error) {
        console.warn('MediaMetadata error:', error);
      }
    },
  };

  // Playback Controls
  const playbackControls = {
    togglePlayPause() {
      if (!playerState.currentSong) return;

      const audio = audioRef.current;
      if (playerState.isPlaying) {
        audio.pause();
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      } else {
        audio.play();
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
      }
    },

    toggleShuffle() {
      setPlayerState(prev => {
        const newShuffleState = !prev.isShuffleOn;
        let shuffledQueue = [];
        if (newShuffleState) {
          shuffledQueue = [...prev.queue];
          for (let i = shuffledQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledQueue[i], shuffledQueue[j]] = [shuffledQueue[j], shuffledQueue[i]];
          }
        }
        return {
          ...prev,
          isShuffleOn: newShuffleState,
          shuffledQueue,
        };
      });
    },

    toggleRepeat() {
      setPlayerState(prev => {
        const newMode = prev.repeatMode === 'off' ? 'all' : prev.repeatMode === 'all' ? 'once' : 'off';
        return { ...prev, repeatMode: newMode };
      });
    },

    playNext() {
      const queue = playerState.isShuffleOn ? playerState.shuffledQueue : playerState.queue;
      if (queue.length === 0) return;

      if (playerState.repeatMode === 'once' && playerState.currentSong) {
        player.play(
          playerState.currentSong.url,
          playerState.currentSong.title,
          playerState.currentSong.thumbnail,
          playerState.currentSong.artist
        );
        return;
      }

      let nextIndex = playerState.currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (playerState.repeatMode === 'all') {
          nextIndex = 0;
        } else {
          setPlayerState(prev => ({ ...prev, isPlaying: false }));
          return;
        }
      }

      setPlayerState(prev => ({ ...prev, currentIndex: nextIndex }));
      const nextSong = queue[nextIndex];
      player.play(nextSong.url, nextSong.title, nextSong.thumbnail, nextSong.artist);
    },

    playPrevious() {
      const queue = playerState.isShuffleOn ? playerState.shuffledQueue : playerState.queue;
      if (queue.length === 0) return;

      let prevIndex = playerState.currentIndex - 1;
      if (prevIndex < 0) {
        if (playerState.repeatMode === 'all') {
          prevIndex = queue.length - 1;
        } else {
          return;
        }
      }

      setPlayerState(prev => ({ ...prev, currentIndex: prevIndex }));
      const prevSong = queue[prevIndex];
      player.play(prevSong.url, prevSong.title, prevSong.thumbnail, prevSong.artist);
    },
  };

  // Library Management
  const library = {
    async load() {
      try {
        const response = await axios.get(`${API_URL}/api/library`, {
          withCredentials: true
        });
        if (response.data.success) {
          setPlayerState(prev => ({ ...prev, library: response.data.library || [] }));
        }
      } catch (error) {
        console.error('Error loading library:', error);
      }
    },

    async add(songData) {
      try {
        const response = await axios.post(`${API_URL}/api/library/add`, songData, {
          withCredentials: true
        });
        if (response.data.success) {
          setPlayerState(prev => ({
            ...prev,
            library: [...prev.library, songData],
          }));
        }
      } catch (error) {
        console.error('Error adding to library:', error);
        alert('Failed to add song to library');
      }
    },

    async remove(songData) {
      try {
        const response = await axios.post(
          `${API_URL}/api/library/remove`,
          { url: songData.url },
          { withCredentials: true }
        );
        if (response.data.success) {
          setPlayerState(prev => ({
            ...prev,
            library: prev.library.filter(song => song.url !== songData.url),
          }));
        }
      } catch (error) {
        console.error('Error removing from library:', error);
        alert('Failed to remove song from library');
      }
    },

    async toggleLike(song) {
      if (!song) return;
      const isInLibrary = playerState.library.some(s => s.url === song.url);
      if (isInLibrary) {
        await this.remove(song);
      } else {
        await this.add(song);
      }
    },
  };

  // Volume Control
  const updateVolume = (volume) => {
    const clampedVolume = Math.min(Math.max(volume, 0), 1);
    audioRef.current.volume = clampedVolume;
    setPlayerState(prev => ({ ...prev, volume: clampedVolume }));
  };

  // Initial Setup
  useEffect(() => {
    library.load();

    if ('Notification' in window) {
      Notification.requestPermission();
    }

    return () => {
      audioRef.current.pause();
      audioRef.current.src = '';
    };
  }, []);

  return {
    playerState,
    player,
    playbackControls,
    library,
    audioRef,
    updateVolume,
  };
};

export default usePlayer;
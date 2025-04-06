import { useState, useEffect, useRef } from 'react';

const usePlayer = () => {
  // Player State
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
    libraryQueue: []
  });

  const audioRef = useRef(new Audio());

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
          retryCount: 0
        }));

        const newSong = { url: cleanUrl, title, thumbnail, artist };
        setPlayerState(prev => ({
          ...prev,
          currentSong: newSong
        }));

        const response = await fetch('/play', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          credentials: 'include'
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const data = await response.json();

        if (!data.success || !data.audio_url) {
          throw new Error(data.error || 'Failed to get audio URL');
        }

        await this.setupAudioPlayback(data.audio_url, data.duration);
        setPlayerState(prev => ({ ...prev, isPlaying: true }));

      } catch (error) {
        console.error('Error playing song:', error);
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
        audioRef.current.pause();
        audioRef.current.src = audioUrl;
        audioRef.current.volume = playerState.volume;

        audioRef.current.onended = () => playbackControls.playNext();
        audioRef.current.onerror = (error) => {
          console.error('Audio playback error:', error);
          this.handlePlaybackError();
        };

        audioRef.current.ontimeupdate = () => {
          // This will be handled in the component using the audio ref
        };

        await audioRef.current.play();
      } catch (error) {
        console.error('Error setting up audio playback:', error);
        throw error;
      }
    },

    async handlePlaybackError() {
      if (!playerState.isPlaying && playerState.retryCount < playerState.maxRetries) {
        setPlayerState(prev => ({
          ...prev,
          retryCount: prev.retryCount + 1
        }));
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (playerState.currentSong) {
          await this.play(
            playerState.currentSong.url,
            playerState.currentSong.title,
            playerState.currentSong.thumbnail,
            playerState.currentSong.artist
          );
          return;
        }
      }

      alert('Failed to play the song after retries. Please try another one.');
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false,
        currentSong: null
      }));
    },

    playFromLibrary(url, title, thumbnail, artist) {
      if (!playerState.libraryQueue.length) {
        const newQueue = playerState.library.map(song => ({
          url: song.url,
          title: song.title,
          thumbnail: song.thumbnail,
          artist: song.artist
        }));
        setPlayerState(prev => ({
          ...prev,
          libraryQueue: newQueue
        }));
      }

      const songIndex = playerState.libraryQueue.findIndex(song => song.url === url);
      if (songIndex !== -1) {
        setPlayerState(prev => ({
          ...prev,
          currentIndex: songIndex,
          queue: prev.libraryQueue
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
    }
  };

  // Playback Controls
  const playbackControls = {
    togglePlayPause() {
      if (!playerState.currentSong) return;

      if (playerState.isPlaying) {
        audioRef.current.pause();
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      } else {
        audioRef.current.play();
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
          shuffledQueue
        };
      });
    },

    toggleRepeat() {
      setPlayerState(prev => {
        let newMode = 'off';
        switch (prev.repeatMode) {
          case 'off': newMode = 'all'; break;
          case 'all': newMode = 'once'; break;
          case 'once': newMode = 'off'; break;
        }
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
    }
  };

  // Library Management
  const library = {
    async load() {
      try {
        const response = await fetch('/library/get', {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setPlayerState(prev => ({ ...prev, library: data.library }));
        }
      } catch (error) {
        console.error('Error loading library:', error);
      }
    },

    async add(songData) {
      try {
        const response = await fetch('/library/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(songData),
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setPlayerState(prev => ({
            ...prev,
            library: [...prev.library, songData]
          }));
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(songData),
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setPlayerState(prev => ({
            ...prev,
            library: prev.library.filter(song => song.url !== songData.url)
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
    }
  };

  // Volume Control
  const updateVolume = (volume) => {
    const clampedVolume = Math.min(Math.max(volume, 0), 1);
    setPlayerState(prev => ({ ...prev, volume }));
    audioRef.current.volume = clampedVolume;
  };

  // Initial Setup
  useEffect(() => {
    library.load();
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  return {
    playerState,
    player,
    playbackControls,
    library,
    audioRef,
    updateVolume
  };
};

export default usePlayer;
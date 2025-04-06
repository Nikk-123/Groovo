import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlayer from './usePlayer';
import './Dashboard.css'; // Your existing CSS file

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    userEmail: '',
    trending: [],
    moodPlaylists: {}
  });
  const navigate = useNavigate();

  // Use the player hook instead of local state
  const {
    playerState,
    player,
    playbackControls,
    library,
    audioRef,
    updateVolume
  } = usePlayer();

  // Handle image loading errors
  const handleImageError = (e) => {
    // Set a fallback image when the YouTube thumbnail fails to load
    e.target.src = '/placeholder-music.svg';
    e.target.onerror = null; // Prevent infinite loop if fallback also fails
  };

  useEffect(() => {
    // Fetch dashboard data when component mounts
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dashboard', {
        credentials: 'include', // Important for cookies/session
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDashboardData({
          userEmail: data.user_email,
          trending: data.trending || [],
          moodPlaylists: data.mood_playlists || {}
        });
        
        // Note: We don't need to call library.load() here as it's already called in usePlayer's useEffect
      } else {
        // If not authenticated, redirect to login
        if (data.redirect) {
          navigate(data.redirect);
        } else {
          setError(data.message || 'Failed to load dashboard data');
        }
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setError('Failed to connect to the server');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLibrary = () => {
    setLibraryVisible(!libraryVisible);
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length > 2) {
      try {
        const response = await fetch(`/search?query=${encodeURIComponent(query)}`, {
          credentials: 'include'
        });
        const data = await response.json();
        setSearchResults(data || []);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
      }
    } else {
      setShowSearchResults(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Clear any local state
        setDashboardData({
          userEmail: '',
          trending: [],
          moodPlaylists: {}
        });
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchResults(false);
        setLibraryVisible(false);
        setDropdownVisible(false);
        
        // Stop any playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        
        // Navigate to login page
        navigate('/login', { replace: true });
      } else {
        console.error('Logout failed:', await response.text());
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div>
      <div className="top-nav">
        <div className="left-nav">
          <h1>Gareeb ka Spotify!</h1>
          <button type="button" className="home-btn" title="Home" onClick={() => navigate('/')}>
            <i className="fas fa-home"></i>
          </button>
        </div>
        <div className="search-section">
          <input
            type="text"
            id="searchInput"
            placeholder="What do you want to listen to?"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
        <div className="right-nav">
        <button
          type="button"
          className="library-toggle"
          id="libraryToggleMain"
          title="Toggle Library"
          onClick={toggleLibrary}
        >
          <i className="fas fa-list"></i>
        </button>
        <div className="profile-menu">
          <button
            type="button"
            className="profile-btn"
            id="profileBtn"
            title="Profile"
            onClick={() => setDropdownVisible(!dropdownVisible)}
          >
            <i className="fas fa-user-circle"></i>
          </button>
          {dropdownVisible && (
            <div className="dropdown-menu" id="profileDropdown">
              <div className="dropdown-header">
                <i className="fas fa-user-circle"></i>
                <span>{dashboardData.userEmail}</span>
              </div>
              <div className="dropdown-divider"></div>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={handleLogout}
                >
                <i className="fas fa-sign-out-alt"></i>
                Log out
                </button>
            </div>
          )}
          </div>
        </div>
      </div>

      <div className="main">
        {showSearchResults && (
          <div id="searchResultsContainer">
            <h1>Search Results</h1>
            <ul id="search-result" className="song-list">
              {searchResults.map((song, index) => (
                <li
                  key={index}
                  className={`song-item ${playerState.currentSong?.url === song.url && playerState.isPlaying ? 'playing' : ''}`}
                  data-url={song.url}
                  data-title={song.title}
                  data-thumbnail={song.thumbnail}
                  data-artist={song.artist}
                >
                  <img className="song-thumbnail" src={song.thumbnail} alt={song.title} onError={handleImageError} />
                  <div className="song-info">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                    <div className="song-buttons">
                      <button
                        onClick={() => player.togglePlayPause(song.url, song.title, song.thumbnail, song.artist)}
                        className="play-btn"
                      >
                        <i className={`fas ${playerState.currentSong?.url === song.url && playerState.isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                      </button>
                      <button
                        className="add-to-library"
                        onClick={() => library.toggleLike(song)}
                        title="Save to Library"
                      >
                        <i className={`fa-heart ${playerState.library.some(s => s.url === song.url) ? 'fas' : 'far'}`}></i>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div id="trendingContainer" style={{ display: showSearchResults ? 'none' : 'block' }}>
          <h1>Trending Songs</h1>
          <ul className="song-list">
            {dashboardData.trending.map((song, index) => (
              <li
                key={index}
                className={`song-item ${playerState.currentSong?.url === song.url && playerState.isPlaying ? 'playing' : ''}`}
                data-url={song.url}
                data-title={song.title}
                data-thumbnail={song.thumbnail}
                data-artist={song.artist}
              >
                <img className="song-thumbnail" src={song.thumbnail} alt={song.title} onError={handleImageError} />
                <div className="song-info">
                  <h3>{song.title}</h3>
                  <p>{song.artist}</p>
                  <div className="song-buttons">
                    <button
                      onClick={() => player.togglePlayPause(song.url, song.title, song.thumbnail, song.artist)}
                      className="play-btn"
                    >
                      <i className={`fas ${playerState.currentSong?.url === song.url && playerState.isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <button
                      className="add-to-library"
                      onClick={() => library.toggleLike(song)}
                      title="Save to Library"
                    >
                      <i className={`fa-heart ${playerState.library.some(s => s.url === song.url) ? 'fas' : 'far'}`}></i>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div id="moodPlaylistsContainer" style={{ display: showSearchResults ? 'none' : 'block' }}>
          {Object.entries(dashboardData.moodPlaylists).map(([mood, songs]) => (
            <div key={mood} className="mood-section">
              <h2>{mood} Mood</h2>
              <div className="mood-playlist">
                <ul className="song-list">
                  {songs.map((song, index) => (
                    <li
                      key={index}
                      className={`song-item ${playerState.currentSong?.url === song.url && playerState.isPlaying ? 'playing' : ''}`}
                      data-url={song.url}
                      data-title={song.title}
                      data-thumbnail={song.thumbnail}
                      data-artist={song.channel}
                    >
                      <img className="song-thumbnail" src={song.thumbnail} alt={song.title} onError={handleImageError} />
                      <div className="song-info">
                        <h3>{song.title}</h3>
                        <p>{song.channel}</p>
                        <div className="song-buttons">
                          <button
                            onClick={() => player.togglePlayPause(song.url, song.title, song.thumbnail, song.channel)}
                            className="play-btn"
                          >
                            <i className={`fas ${playerState.currentSong?.url === song.url && playerState.isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                          </button>
                          <button
                            className="add-to-library"
                            onClick={() => library.toggleLike(song)}
                            title="Save to Library"
                          >
                            <i className={`fa-heart ${playerState.library.some(s => s.url === song.url) ? 'fas' : 'far'}`}></i>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {playerState.currentSong && (
          <div className="audio-control-container" id="audioControlContainer">
            {/* Mini Player */}
            <div className="mini-player">
              <div className="mini-player-content">
                <div className="mini-song-info">
                  <img
                    id="miniThumbnail"
                    className="mini-thumbnail"
                    src={playerState.currentSong.thumbnail}
                    alt=""
                    onError={handleImageError}
                  />
                  <div className="mini-text-info">
                    <span id="miniSongTitle" className="mini-title">
                      {playerState.currentSong.title}
                    </span>
                    <span id="miniArtist" className="mini-artist">
                      {playerState.currentSong.artist}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mini-like-btn"
                    title="Like"
                    onClick={() => library.toggleLike(playerState.currentSong)}
                  >
                    <i className={`fa-heart ${playerState.library.some(s => s.url === playerState.currentSong.url) ? 'fas' : 'far'}`} id="likeButtonIcon"></i>
                  </button>
                </div>
                <div className="mini-player-controls">
                  <div className="mini-control-buttons">
                    <button
                      type="button"
                      className={`mini-control-btn shuffle ${playerState.isShuffleOn ? 'active' : ''}`}
                      id="miniShuffleBtn"
                      title="Shuffle"
                      onClick={playbackControls.toggleShuffle}
                    >
                      <i className="fas fa-random"></i>
                    </button>
                    <button
                      type="button"
                      id="miniPrevBtn"
                      className="mini-control-btn"
                      title="Previous"
                      onClick={playbackControls.playPrevious}
                    >
                      <i className="fas fa-step-backward"></i>
                    </button>
                    <button
                      id="miniPlayBtn"
                      className="mini-control-btn play-pause"
                      type="button"
                      title="Play/Pause"
                      onClick={playbackControls.togglePlayPause}
                    >
                      <i className={`fas ${playerState.isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <button
                      id="miniNextBtn"
                      className="mini-control-btn"
                      type="button"
                      title="Next"
                      onClick={playbackControls.playNext}
                    >
                      <i className="fas fa-step-forward"></i>
                    </button>
                    <button
                      type="button"
                      className={`mini-control-btn repeat ${playerState.repeatMode !== 'off' ? 'active' : ''}`}
                      id="miniRepeatBtn"
                      title={`Repeat (${playerState.repeatMode})`}
                      onClick={playbackControls.toggleRepeat}
                    >
                      <i className="fas fa-redo"></i>
                    </button>
                  </div>
                  <div className="mini-progress-container">
                    <span className="time current-time">0:00</span>
                    <div className="mini-progress-bar" id="miniProgressBar">
                      <div className="progress" id="miniProgress"></div>
                    </div>
                    <span className="time total-time">0:00</span>
                  </div>
                </div>
                <div className="mini-volume-controls">
                  <button
                    type="button"
                    className="mini-control-btn"
                    id="miniVolumeBtn"
                    title="Volume"
                    onClick={() => updateVolume(playerState.volume === 0 ? 1 : 0)}
                  >
                    <i className={`fas ${playerState.volume === 0 ? 'fa-volume-mute' : playerState.volume < 0.5 ? 'fa-volume-down' : 'fa-volume-up'}`}></i>
                  </button>
                  <input
                    type="range"
                    id="miniVolumeControl"
                    min="0"
                    max="1"
                    step="0.01"
                    value={playerState.volume}
                    title="Volume"
                    onChange={(e) => updateVolume(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Expanded Player */}
            <div className={`expanded-player ${playerState.showExpanded ? 'show' : ''}`} id="expandedPlayer">
              {/* Add expanded player content */}
            </div>
            <audio ref={audioRef} id="audioPlayer" preload="auto" style={{ display: 'none' }} />
          </div>
        )}

        <div className={`library-section ${libraryVisible ? 'show' : ''}`} id="librarySection">
          <div className="library-header">
            <h2>Liked Songs</h2>
            <button
              type="button"
              className="library-toggle"
              onClick={toggleLibrary}
              title="Toggle Library"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          {playerState.library.length === 0 ? (
            <div id="emptyLibraryMessage">
              Your library is empty. Add songs to get started!
            </div>
          ) : (
            <ul className="library-list" id="libraryList">
              {playerState.library.map((song, index) => (
                <li
                  key={index}
                  className={`library-item ${playerState.currentSong?.url === song.url && playerState.isPlaying ? 'playing' : ''}`}
                  data-url={song.url}
                  data-title={song.title}
                  data-thumbnail={song.thumbnail}
                  data-artist={song.artist}
                >
                  <img className="song-thumbnail" src={song.thumbnail} alt={song.title} onError={handleImageError} />
                  <div className="library-item-info">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>
                  <div className="library-item-controls">
                    <button
                      className="play-btn"
                      onClick={() => player.togglePlayFromLibrary(song.url, song.title, song.thumbnail, song.artist)}
                      title="Play/Pause"
                    >
                      <i className={`fas ${playerState.currentSong?.url === song.url && playerState.isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <button
                      className="remove-from-library"
                      onClick={() => library.remove(song)}
                      title="Remove from Library"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
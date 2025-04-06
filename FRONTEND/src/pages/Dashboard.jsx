import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; // Your existing CSS file

const Dashboard = ({ userEmail, trendingSongs, moodPlaylists, userLibrary, currentSongUrl, isPlaying }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const navigate = useNavigate();

  // Simulated player state (you might want to move this to a separate context/provider)
  const [playerState, setPlayerState] = useState({
    currentSong: null,
    isPlaying: false,
    showExpanded: false,
  });

  useEffect(() => {
    // Initialize with your existing player.js if needed
    // You might want to move player logic to a separate hook/context
  }, []);

  const toggleLibrary = () => {
    setLibraryVisible(!libraryVisible);
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length > 2) {
      try {
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setSearchResults(data.results || []);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
      }
    } else {
      setShowSearchResults(false);
    }
  };

  const playSong = (url, title, thumbnail, artist) => {
    setPlayerState({
      currentSong: { url, title, thumbnail, artist },
      isPlaying: true,
      showExpanded: false,
    });
    // Add your audio player logic here
  };

  const toggleLike = async (song) => {
    try {
      const response = await fetch('/library/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
      });
      const data = await response.json();
      // Update library state based on response
    } catch (error) {
      console.error('Toggle like error:', error);
    }
  };

  const removeFromLibrary = async (song) => {
    try {
      const response = await fetch('/library/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
      });
      const data = await response.json();
      // Update library state based on response
    } catch (error) {
      console.error('Remove from library error:', error);
    }
  };

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
                <span>{userEmail}</span>
              </div>
              <div className="dropdown-divider"></div>
              <a href="/logout" className="dropdown-item">
                <i className="fas fa-sign-out-alt"></i>
                Log out
              </a>
            </div>
          )}
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
                  className="song-item"
                  data-url={song.url}
                  data-title={song.title}
                  data-thumbnail={song.thumbnail}
                  data-artist={song.artist}
                >
                  <img className="song-thumbnail" src={song.thumbnail} alt={song.title} />
                  <div className="song-info">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                    <div className="song-buttons">
                      <button
                        onClick={() => playSong(song.url, song.title, song.thumbnail, song.artist)}
                        className="play-btn"
                      >
                        <i className="fas fa-play"></i>
                      </button>
                      <button
                        className="add-to-library"
                        onClick={() => toggleLike(song)}
                        title="Save to Library"
                      >
                        <i className={`fa-heart ${userLibrary.some(s => s.url === song.url) ? 'fas' : 'far'}`}></i>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div id="trendingContainer">
          <h1>Trending Songs</h1>
          <ul className="song-list">
            {trendingSongs.map((song, index) => (
              <li
                key={index}
                className="song-item"
                data-url={song.url}
                data-title={song.title}
                data-thumbnail={song.thumbnail}
                data-artist={song.artist}
              >
                <img className="song-thumbnail" src={song.thumbnail} alt={song.title} />
                <div className="song-info">
                  <h3>{song.title}</h3>
                  <p>{song.artist}</p>
                  <div className="song-buttons">
                    <button
                      onClick={() => playSong(song.url, song.title, song.thumbnail, song.artist)}
                      className="play-btn"
                    >
                      <i className="fas fa-play"></i>
                    </button>
                    <button
                      className="add-to-library"
                      onClick={() => toggleLike(song)}
                      title="Save to Library"
                    >
                      <i className={`fa-heart ${userLibrary.some(s => s.url === song.url) ? 'fas' : 'far'}`}></i>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div id="moodPlaylistsContainer">
          {Object.entries(moodPlaylists).map(([mood, songs]) => (
            <div key={mood} className="mood-section">
              <h2>{mood} Mood</h2>
              <div className="mood-playlist">
                <ul className="song-list">
                  {songs.map((song, index) => (
                    <li
                      key={index}
                      className="song-item"
                      data-url={song.url}
                      data-title={song.title}
                      data-thumbnail={song.thumbnail}
                      data-artist={song.channel}
                    >
                      <img className="song-thumbnail" src={song.thumbnail} alt={song.title} />
                      <div className="song-info">
                        <h3>{song.title}</h3>
                        <p>{song.channel}</p>
                        <div className="song-buttons">
                          <button
                            onClick={() => playSong(song.url, song.title, song.thumbnail, song.channel)}
                            className="play-btn"
                          >
                            <i className="fas fa-play"></i>
                          </button>
                          <button
                            className="add-to-library"
                            onClick={() => toggleLike(song)}
                            title="Save to Library"
                          >
                            <i className={`fa-heart ${userLibrary.some(s => s.url === song.url) ? 'fas' : 'far'}`}></i>
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
                    onClick={() => toggleLike(playerState.currentSong)}
                  >
                    <i className={`fa-heart ${userLibrary.some(s => s.url === playerState.currentSong.url) ? 'fas' : 'far'}`} id="likeButtonIcon"></i>
                  </button>
                </div>
                {/* Add other mini-player controls as needed */}
              </div>
            </div>

            {/* Expanded Player */}
            <div className="expanded-player" id="expandedPlayer">
              {/* Add expanded player content */}
            </div>
            <audio id="audioPlayer" preload="auto" style={{ display: 'none' }} />
          </div>
        )}

        <div className={`library-section ${libraryVisible ? 'visible' : ''}`} id="librarySection">
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

          {userLibrary.length === 0 ? (
            <div id="emptyLibraryMessage">
              Your library is empty. Add songs to get started!
            </div>
          ) : (
            <ul className="library-list" id="libraryList">
              {userLibrary.map((song, index) => (
                <li
                  key={index}
                  className="library-item"
                  data-url={song.url}
                  data-title={song.title}
                  data-thumbnail={song.thumbnail}
                  data-artist={song.artist}
                >
                  <img className="song-thumbnail" src={song.thumbnail} alt={song.title} />
                  <div className="library-item-info">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>
                  <div className="library-item-controls">
                    <button
                      className="play-btn"
                      onClick={() => playSong(song.url, song.title, song.thumbnail, song.artist)}
                      title="Play/Pause"
                    >
                      <i className={`fas ${song.url === currentSongUrl && isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <button
                      className="remove-from-library"
                      onClick={() => removeFromLibrary(song)}
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
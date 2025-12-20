document.addEventListener('DOMContentLoaded', () => {
    loadTrending();
    loadMoodPlaylists();
    if (window.Library) {
        Library.load();
    }
});

async function loadTrending() {
    try {
        const response = await fetch('/api/trending');
        if (!response.ok) throw new Error('Network response was not ok');
        const songs = await response.json();

        const container = document.getElementById('trending-list');
        if (container) {
            container.innerHTML = ''; // Clear skeletons
            songs.forEach(song => {
                const card = createSongCard(song);
                container.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error loading trending songs:', error);
    }
}

async function loadMoodPlaylists() {
    const playlists = document.querySelectorAll('.mood-playlist ul[data-mood]');

    // Load them in parallel (or limit concurrency if needed, but start simple)
    playlists.forEach(async (list) => {
        const mood = list.getAttribute('data-mood');
        try {
            const response = await fetch(`/api/playlist?mood=${encodeURIComponent(mood)}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            // Re-select strictly to ensure we have the element 
            if (list) {
                list.innerHTML = ''; // Clear skeletons
                // data is { mood: "Name", songs: [...] } or just [...]? Check app.py design.
                // Based on plan, /api/playlist returns list of songs.
                if (Array.isArray(data)) {
                    data.forEach(song => {
                        const card = createSongCard(song);
                        list.appendChild(card);
                    });
                }
            }
        } catch (error) {
            console.error(`Error loading mood ${mood}:`, error);
        }
    });
}

function createSongCard(song) {
    const li = document.createElement('li');
    li.className = 'song-item';
    li.setAttribute('data-url', song.url);
    li.setAttribute('data-title', song.title);
    li.setAttribute('data-thumbnail', song.thumbnail);
    // Be careful with property names. app.py uses 'channel' sometimes and 'artist' others.
    // The API should standardize this. Let's assume the API returns 'artist' or we fallback.
    const artist = song.artist || song.channel || 'Unknown Artist';
    li.setAttribute('data-artist', artist);

    li.innerHTML = `
        <img class="song-thumbnail" src="${song.thumbnail}" alt="${song.title}" loading="lazy" />
        <div class="song-info">
            <h3>${song.title}</h3>
            <p>${artist}</p>
            <div class="song-buttons">
              <button
                onclick="Player.play('${escapeHtml(song.url)}', '${escapeHtml(song.title)}', '${escapeHtml(song.thumbnail)}', '${escapeHtml(artist)}')"
                class="play-btn">
                <i class="fas fa-play"></i>
              </button>
              <button class="add-to-library"
                onclick="Library.toggleLike({url: '${escapeHtml(song.url)}', title: '${escapeHtml(song.title)}', thumbnail: '${escapeHtml(song.thumbnail)}', artist: '${escapeHtml(artist)}'})"
                title="Save to Library">
                <i class="far fa-heart"></i>
              </button>
            </div>
        </div>
    `;

    // Check if in library to toggle heart (optional optimization: fetch library ids first)
    // For now, client-side check might require passing user_library_urls to JS.
    // We can expose it as a global variable in the template.
    if (window.USER_LIBRARY_URLS && window.USER_LIBRARY_URLS.includes(song.url)) {
        const heart = li.querySelector('.add-to-library i');
        if (heart) {
            heart.classList.remove('far');
            heart.classList.add('fas');
        }
    }

    return li;
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

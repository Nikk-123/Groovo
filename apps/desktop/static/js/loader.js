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
                // Initialize scroll dots for this mood section
                initMoodScrollDots(list);
            }
        } catch (error) {
            console.error(`Error loading mood ${mood}:`, error);
        }
    });
}

function initMoodScrollDots(songList) {
    const moodPlaylist = songList.closest('.mood-playlist');
    if (!moodPlaylist) return;

    const dotsContainer = moodPlaylist.querySelector('.mood-scroll-dots');
    const dots = moodPlaylist.querySelectorAll('.mood-scroll-dots .scroll-dot');
    if (!dotsContainer || !dots.length) return;

    const setActiveDot = (index) => {
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    };

    const updateDotsVisibility = () => {
        // Only show dots when content overflows (small window)
        const overflows = songList.scrollWidth > songList.clientWidth + 2; // Add a small tolerance
        dotsContainer.style.display = overflows ? 'flex' : 'none';
    };

    const updateDots = () => {
        updateDotsVisibility();
        const maxScroll = songList.scrollWidth - songList.clientWidth;
        if (maxScroll <= 0) {
            setActiveDot(0);
            return;
        }
        const ratio = songList.scrollLeft / maxScroll;
        const index = Math.min(dots.length - 1, Math.floor(ratio * dots.length));
        setActiveDot(index);
    };

    const scrollToDot = (index) => {
        const maxScroll = songList.scrollWidth - songList.clientWidth;
        if (maxScroll <= 0) return;
        const clampedIndex = Math.max(0, Math.min(index, dots.length - 1));
        const ratio = dots.length === 1 ? 0 : clampedIndex / (dots.length - 1);
        const target = ratio * maxScroll;
        songList.scrollTo({ left: target, behavior: 'smooth' });
    };

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => scrollToDot(index));
    });

    // Mouse wheel horizontal scrolling + circular wrap
    songList.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        const maxScroll = songList.scrollWidth - songList.clientWidth;
        if (maxScroll <= 0) return;
        const next = songList.scrollLeft + e.deltaY;
        if (next >= maxScroll - 2) {
            songList.scrollLeft = 0;
            return;
        }
        if (next <= 2) {
            songList.scrollLeft = maxScroll;
            return;
        }
        songList.scrollLeft = next;
    }, { passive: false });

    songList.addEventListener('scroll', updateDots, { passive: true });
    window.addEventListener('resize', updateDots);
    updateDots();
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
    const duration = song.duration || '';
    li.setAttribute('data-duration', duration);

    li.innerHTML = `
        <img class="song-thumbnail" src="${escapeHtml(song.thumbnail)}" alt="" loading="lazy" />
        <div class="song-info">
            <h3></h3>
            <p></p>
            <div class="song-buttons">
              <button class="play-btn">
                <i class="fas fa-play"></i>
              </button>
              <button class="add-to-library" title="Save to Library">
                <i class="far fa-heart"></i>
              </button>
            </div>
        </div>
    `;

    // Safe text insertion (title/artist set via textContent, not innerHTML)
    li.querySelector('h3').textContent = song.title;
    li.querySelector('p').textContent = artist;
    // Set alt via property after the fact so it also goes through textContent rules
    li.querySelector('.song-thumbnail').alt = song.title;

    // Attach event listeners safely
    const playBtn = li.querySelector('.play-btn');
    playBtn.onclick = () => Player.play(song.url, song.title, song.thumbnail, artist);

    const likeBtn = li.querySelector('.add-to-library');
    likeBtn.onclick = () => Library.toggleLike({
        url: song.url,
        title: song.title,
        thumbnail: song.thumbnail,
        artist: artist,
        duration: duration
    });

    // Check if in library to toggle heart (optional optimization: fetch library ids first)
    // For now, client-side check might require passing user_library_urls to JS.
    // We can expose it as a global variable in the template.
    if (window.USER_LIBRARY_URLS && window.USER_LIBRARY_URLS.includes(song.url)) {
        const heart = likeBtn.querySelector('i');
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
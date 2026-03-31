document.addEventListener('DOMContentLoaded', () => {
    loadTrending();
    loadMoodPlaylists();
    if (window.Library) {
        Library.load();
    }
    // Recently Played is rendered by features.js after DOM ready,
    // but call it here too as a safe fallback (features.js may not be loaded yet).
    if (window.RecentlyPlayed) {
        RecentlyPlayed.render();
    }
});

/* ─────────────────────────────────────────────────────────────
   Skeleton helpers — generate skeleton cards dynamically so the
   count always matches what the fetch will return.
   ───────────────────────────────────────────────────────────── */
function buildSkeletons(count = 7) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const li = document.createElement('li');
        li.className = 'song-item skeleton';
        li.innerHTML = `
            <div class="skeleton-img"></div>
            <div class="skeleton-text skeleton-title"></div>
            <div class="skeleton-text skeleton-artist"></div>
        `;
        fragment.appendChild(li);
    }
    return fragment;
}

async function loadTrending() {
    const container = document.getElementById('trending-list');
    if (!container) return;

    // Replace static skeletons from HTML with a dynamically-sized set
    container.innerHTML = '';
    container.appendChild(buildSkeletons(7));

    try {
        const response = await fetch('/api/trending');
        if (!response.ok) throw new Error('Network response was not ok');
        const songs = await response.json();

        container.innerHTML = ''; // Clear skeletons
        songs.forEach(song => {
            const card = createSongCard(song);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading trending songs:', error);
    }
}

async function loadMoodPlaylists() {
    const playlists = document.querySelectorAll('.mood-playlist ul[data-mood]');

    // Refresh skeletons dynamically before firing fetches
    playlists.forEach(list => {
        list.innerHTML = '';
        list.appendChild(buildSkeletons(7));
    });

    // Use Promise.allSettled so all moods load in parallel and failures are
    // individually reported without blocking the others.
    const tasks = Array.from(playlists).map(async (list) => {
        const mood = list.getAttribute('data-mood');
        try {
            const response = await fetch(`/api/playlist?mood=${encodeURIComponent(mood)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            list.innerHTML = ''; // Clear skeletons

            if (Array.isArray(data)) {
                data.forEach(song => {
                    const card = createSongCard(song);
                    list.appendChild(card);
                });
            }
            initMoodScrollDots(list);
        } catch (error) {
            console.error(`Error loading mood "${mood}":`, error);
            // Leave skeletons visible rather than crashing other moods
        }
    });

    await Promise.allSettled(tasks);
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
        const overflows = songList.scrollWidth > songList.clientWidth + 2;
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
        songList.scrollTo({ left: ratio * maxScroll, behavior: 'smooth' });
    };

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => scrollToDot(index));
    });

    // Mouse-wheel horizontal scrolling + circular wrap
    songList.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        const maxScroll = songList.scrollWidth - songList.clientWidth;
        if (maxScroll <= 0) return;
        const next = songList.scrollLeft + e.deltaY;
        if (next >= maxScroll - 2) { songList.scrollLeft = 0; return; }
        if (next <= 2) { songList.scrollLeft = maxScroll; return; }
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

    // youtube.py now always returns 'artist'. 'channel' kept as legacy fallback.
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

    // Safe text insertion via textContent (never innerHTML for user data)
    li.querySelector('h3').textContent = song.title;
    li.querySelector('p').textContent = artist;
    li.querySelector('.song-thumbnail').alt = song.title;

    const playBtn = li.querySelector('.play-btn');
    playBtn.onclick = () => Player.play(song.url, song.title, song.thumbnail, artist);

    const likeBtn = li.querySelector('.add-to-library');
    likeBtn.onclick = () => Library.toggleLike({
        url: song.url,
        title: song.title,
        thumbnail: song.thumbnail,
        artist: artist,
        duration: duration,
    });

    if (window.USER_LIBRARY_URLS && window.USER_LIBRARY_URLS.includes(song.url)) {
        const heart = likeBtn.querySelector('i');
        if (heart) heart.classList.replace('far', 'fas');
    }

    return li;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
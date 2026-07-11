// -----------------------------------------------------------------------
// State
// -----------------------------------------------------------------------

let likedIds = new Set();   // video_ids currently liked, kept in sync with /liked
let currentSong = null;     // the song object currently loaded in the player

const MOODS = [
    { key: "chill",   name: "Chill",     emoji: "🌊", cls: "mood-chill",   query: "chill lofi relaxing music" },
    { key: "party",   name: "Party",     emoji: "🎉", cls: "mood-party",   query: "party dance hits" },
    { key: "focus",   name: "Focus",     emoji: "🎯", cls: "mood-focus",   query: "deep focus instrumental music" },
    { key: "workout", name: "Workout",   emoji: "🏋️", cls: "mood-workout", query: "workout gym pump up music" },
    { key: "sad",     name: "Sad",       emoji: "🌧️", cls: "mood-sad",     query: "sad emotional songs" },
    { key: "happy",   name: "Happy",     emoji: "☀️", cls: "mood-happy",   query: "feel good happy songs" },
    { key: "sleep",   name: "Sleep",     emoji: "🌙", cls: "mood-sleep",   query: "sleep ambient calm music" },
    { key: "romance", name: "Romance",   emoji: "💗", cls: "mood-romance", query: "romantic love songs" }
];

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function songCardMarkup(song, { variant }) {
    const liked = likedIds.has(song.id);
    const cardClass = variant === "rail" ? "rail-card" : "song-card";
    const titleClass = variant === "rail" ? "rt" : "st";
    const channelClass = variant === "rail" ? "rc" : "sc";

    return `
        <div class="${cardClass}" data-song='${escapeHtml(JSON.stringify(song))}'>
            <img src="${escapeHtml(song.thumbnail || "")}" alt="" loading="lazy"
                 onclick="playSongObject(JSON.parse(this.closest('[data-song]').dataset.song))">
            <div class="${titleClass}">${escapeHtml(song.title)}</div>
            <div class="${channelClass}">${escapeHtml(song.channel || "")}</div>
            ${variant === "grid" ? `
            <div class="song-card-actions">
                <button class="card-like-btn ${liked ? "liked" : ""}"
                        onclick='toggleLike(event, ${escapeHtml(JSON.stringify(song))})'
                        title="${liked ? "Unlike" : "Like"}">
                    ${liked ? "♥" : "♡"}
                </button>
                <button class="card-play-btn"
                        onclick='playSongObject(${escapeHtml(JSON.stringify(song))})'
                        title="Play">▶</button>
            </div>` : `
            <button class="rail-play"
                    onclick='event.stopPropagation(); playSongObject(${escapeHtml(JSON.stringify(song))})'
                    title="Play">▶</button>`}
        </div>
    `;
}

// -----------------------------------------------------------------------
// Search
// -----------------------------------------------------------------------

async function searchSong() {
    const queryInput = document.getElementById("query");
    const query = queryInput.value.trim();

    if (!query) return;

    showSearchResults(`Results for “${query}”`, "Searching…");

    let songs = [];
    try {
        const response = await fetch("/search?q=" + encodeURIComponent(query));
        const data = await response.json();
        songs = Array.isArray(data) ? data : [];
    } catch (err) {
        renderSongGrid("results", [], "Couldn't reach the server. Try again.");
        return;
    }

    if (songs.length === 0) {
        renderSongGrid("results", [], "No songs found. Try a different search.");
        return;
    }

    renderSongGrid("results", songs);
}

function focusSearch() {
    document.getElementById("query").focus();
}

function showSearchResults(title, loadingText) {
    document.getElementById("homeSection").classList.add("hidden");
    document.getElementById("searchResultsSection").classList.remove("hidden");
    document.getElementById("searchResultsTitle").textContent = title;

    document.getElementById("navHome").classList.remove("active");
    document.getElementById("navSearch").classList.add("active");

    if (loadingText) {
        document.getElementById("results").innerHTML =
            `<p class="empty-hint">${escapeHtml(loadingText)}</p>`;
    }
}

function showHome() {
    document.getElementById("homeSection").classList.remove("hidden");
    document.getElementById("searchResultsSection").classList.add("hidden");
    document.getElementById("navHome").classList.add("active");
    document.getElementById("navSearch").classList.remove("active");
}

function renderSongGrid(containerId, songs, emptyMessage) {
    const container = document.getElementById(containerId);

    if (!songs || songs.length === 0) {
        container.innerHTML = `<p class="empty-hint">${escapeHtml(emptyMessage || "Nothing here yet.")}</p>`;
        return;
    }

    container.innerHTML = songs.map(song => songCardMarkup(song, { variant: "grid" })).join("");
}

// -----------------------------------------------------------------------
// Trending
// -----------------------------------------------------------------------

async function loadTrending() {
    const rail = document.getElementById("trending");

    try {
        const response = await fetch("/trending");
        const data = await response.json();
        const songs = Array.isArray(data) ? data : [];

        if (songs.length === 0) {
            rail.innerHTML = `<p class="empty-hint">Nothing trending right now.</p>`;
            return;
        }

        rail.innerHTML = songs.map(song => songCardMarkup(song, { variant: "rail" })).join("");
        initRailScrollDots(rail, "trendingDots");
    } catch (err) {
        rail.innerHTML = `<p class="empty-hint">Couldn't load trending songs.</p>`;
    }
}

// -----------------------------------------------------------------------
// Sidebar drawer (hamburger menu)
// -----------------------------------------------------------------------

function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("drawerBackdrop").classList.add("open");
}

function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("drawerBackdrop").classList.remove("open");
}

// -----------------------------------------------------------------------
// Scroll-dot indicator for horizontally-scrolling rails
// -----------------------------------------------------------------------

function initRailScrollDots(railEl, dotsContainerId) {
    const dotsContainer = document.getElementById(dotsContainerId);
    if (!dotsContainer) return;

    const dots = Array.from(dotsContainer.querySelectorAll(".scroll-dot"));
    if (dots.length === 0) return;

    function setActiveDot() {
        const maxScroll = railEl.scrollWidth - railEl.clientWidth;

        // Nothing to scroll — collapse to a single active dot.
        if (maxScroll <= 0) {
            dots.forEach((dot, i) => dot.classList.toggle("active", i === 0));
            return;
        }

        const progress = railEl.scrollLeft / maxScroll; // 0 → 1
        const index = Math.min(dots.length - 1, Math.round(progress * (dots.length - 1)));
        dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
    }

    // Clicking a dot scrolls the rail to that fraction of its full width.
    dots.forEach((dot, i) => {
        dot.onclick = () => {
            const maxScroll = railEl.scrollWidth - railEl.clientWidth;
            const fraction = i / (dots.length - 1);
            railEl.scrollTo({ left: maxScroll * fraction, behavior: "smooth" });
        };
    });

    railEl.onscroll = setActiveDot;
    setActiveDot();
}

// -----------------------------------------------------------------------
// Mood mixes
// -----------------------------------------------------------------------

function renderMoodGrid() {
    const grid = document.getElementById("moodGrid");

    grid.innerHTML = MOODS.map(mood => `
        <button class="mood-card ${mood.cls}" onclick="openMood('${mood.key}')">
            <span class="mood-name">${mood.name}</span>
            <span class="mood-emoji">${mood.emoji}</span>
        </button>
    `).join("");
}

async function openMood(key) {
    const mood = MOODS.find(m => m.key === key);
    if (!mood) return;

    showSearchResults(`${mood.name} mix`, "Loading tracks…");

    let songs = [];
    try {
        const response = await fetch("/search?q=" + encodeURIComponent(mood.query));
        const data = await response.json();
        songs = Array.isArray(data) ? data : [];
    } catch (err) {
        renderSongGrid("results", [], "Couldn't load this mix. Try again.");
        return;
    }

    renderSongGrid("results", songs, "No tracks found for this mood right now.");
}

// -----------------------------------------------------------------------
// Playback
// -----------------------------------------------------------------------

async function playSong(id) {
    // Kept for backwards compatibility; prefer playSongObject where possible
    // since it carries thumbnail/channel info for the now-playing bar.
    await playSongObject({ id });
}

async function playSongObject(song) {
    currentSong = song;
    updateNowPlayingInfo(song);

    // Reset transport UI immediately so stale progress isn't shown while
    // the new track's metadata loads.
    updateProgressUI(0);
    document.getElementById("npCurrentTime").textContent = "0:00";
    document.getElementById("npDuration").textContent = "0:00";

    try {
        const response = await fetch("/play/" + encodeURIComponent(song.id));
        const data = await response.json();

        if (!data || !data.url) {
            document.getElementById("title").textContent = "Couldn't play this track";
            return;
        }

        const audio = document.getElementById("audio");
        audio.src = data.url;
        audio.play().catch(() => { /* autoplay may be blocked; user can hit play */ });

        document.getElementById("title").textContent = data.title || song.title || "";
    } catch (err) {
        document.getElementById("title").textContent = "Couldn't play this track";
    }
}

function updateNowPlayingInfo(song) {
    const thumb = document.getElementById("npThumb");
    const placeholder = document.getElementById("npThumbPlaceholder");
    const channel = document.getElementById("npChannel");
    const likeBtn = document.getElementById("npLikeBtn");

    if (song.thumbnail) {
        thumb.src = song.thumbnail;
        thumb.hidden = false;
        placeholder.hidden = true;
    } else {
        thumb.hidden = true;
        placeholder.hidden = false;
    }

    channel.textContent = song.channel || "";
    document.getElementById("title").textContent = song.title || "Loading…";

    const liked = song.id && likedIds.has(song.id);
    likeBtn.classList.toggle("liked", !!liked);
    likeBtn.textContent = liked ? "♥" : "♡";
}

// -----------------------------------------------------------------------
// Custom player controls (replaces the native <audio controls> UI)
// -----------------------------------------------------------------------

let isSeeking = false;
let volumeBeforeMute = 100;

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function togglePlayPause() {
    const audio = document.getElementById("audio");
    if (!audio.src) return;

    if (audio.paused) {
        audio.play().catch(() => {});
    } else {
        audio.pause();
    }
}

function setPlayIcon(isPlaying) {
    document.getElementById("npPlayIcon").textContent = isPlaying ? "❚❚" : "▶";
}

function updateProgressUI(fraction) {
    const clamped = Math.max(0, Math.min(1, fraction));
    document.getElementById("npProgressFill").style.width = (clamped * 100) + "%";
    document.getElementById("npProgressHandle").style.left = (clamped * 100) + "%";
}

function seekToClientX(clientX) {
    const audio = document.getElementById("audio");
    const bar = document.getElementById("npProgressBar");
    if (!audio.duration || !isFinite(audio.duration)) return;

    const rect = bar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = fraction * audio.duration;
    updateProgressUI(fraction);
}

function setVolume(value) {
    const audio = document.getElementById("audio");
    const level = Math.max(0, Math.min(100, Number(value)));
    audio.volume = level / 100;
    audio.muted = level === 0;
    document.getElementById("npVolume").style.setProperty("--volume-level", level + "%");
    document.getElementById("npVolume").value = level;
    document.getElementById("npMuteBtn").textContent = level === 0 ? "🔇" : (level < 50 ? "🔉" : "🔊");
    if (level > 0) volumeBeforeMute = level;
}

function toggleMute() {
    const audio = document.getElementById("audio");
    if (audio.muted || audio.volume === 0) {
        setVolume(volumeBeforeMute || 100);
    } else {
        volumeBeforeMute = Math.round(audio.volume * 100);
        setVolume(0);
    }
}

function initPlayerControls() {
    const audio = document.getElementById("audio");
    const bar = document.getElementById("npProgressBar");

    audio.addEventListener("play", () => setPlayIcon(true));
    audio.addEventListener("pause", () => setPlayIcon(false));
    audio.addEventListener("ended", () => setPlayIcon(false));

    audio.addEventListener("loadedmetadata", () => {
        document.getElementById("npDuration").textContent = formatTime(audio.duration);
    });

    audio.addEventListener("timeupdate", () => {
        if (isSeeking) return;
        document.getElementById("npCurrentTime").textContent = formatTime(audio.currentTime);
        if (audio.duration) updateProgressUI(audio.currentTime / audio.duration);
    });

    // Click-to-seek
    bar.addEventListener("click", (e) => seekToClientX(e.clientX));

    // Drag-to-seek
    bar.addEventListener("mousedown", (e) => {
        isSeeking = true;
        seekToClientX(e.clientX);

        const onMove = (moveEvent) => seekToClientX(moveEvent.clientX);
        const onUp = () => {
            isSeeking = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });

    // Spacebar toggles play/pause, unless the person is typing somewhere.
    document.addEventListener("keydown", (e) => {
        const tag = document.activeElement && document.activeElement.tagName;
        if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA") {
            e.preventDefault();
            togglePlayPause();
        }
    });

    setVolume(100);
}

// -----------------------------------------------------------------------
// Liking
// -----------------------------------------------------------------------

async function toggleLike(event, song) {
    if (event) event.stopPropagation();

    if (likedIds.has(song.id)) {
        await unlikeSong(song.id);
    } else {
        await likeSong(song);
    }
}

async function toggleLikeCurrent() {
    if (!currentSong || !currentSong.id) return;
    await toggleLike(null, currentSong);
    updateNowPlayingInfo(currentSong);
}

async function likeSong(song) {
    try {
        await fetch("/like", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(song)
        });
    } catch (err) {
        // Network hiccup — liked list simply won't update; safe to ignore here.
    }

    await loadLikedSongs();
    refreshLikeButtons();
}

async function unlikeSong(id) {
    try {
        await fetch("/unlike/" + encodeURIComponent(id), { method: "DELETE" });
    } catch (err) {
        // Ignore — loadLikedSongs will reflect actual server state either way.
    }

    await loadLikedSongs();
    refreshLikeButtons();
}

async function loadLikedSongs() {
    let songs = [];
    try {
        const response = await fetch("/liked");
        const data = await response.json();
        songs = Array.isArray(data) ? data : [];
    } catch (err) {
        songs = [];
    }

    likedIds = new Set(songs.map(s => s.video_id));

    const liked = document.getElementById("likedSongs");

    if (songs.length === 0) {
        liked.innerHTML = `<p class="empty-hint">Songs you like will show up here.</p>`;
        return;
    }

    liked.innerHTML = songs.map(song => `
        <div class="liked-song" onclick='playSongObject(${escapeHtml(JSON.stringify({
            id: song.video_id, title: song.title, channel: song.channel, thumbnail: song.thumbnail
        }))})'>
            <img src="${escapeHtml(song.thumbnail || "")}" alt="" loading="lazy">
            <div class="liked-song-info">
                <div class="t">${escapeHtml(song.title)}</div>
                <div class="c">${escapeHtml(song.channel || "")}</div>
            </div>
            <button class="remove-btn" title="Remove"
                    onclick="event.stopPropagation(); unlikeSong('${escapeHtml(song.video_id)}')">
                ✕
            </button>
        </div>
    `).join("");
}

function refreshLikeButtons() {
    // Re-sync any like buttons currently on screen (search grid + now-playing bar)
    // without a full re-render, so scroll position / loaded audio isn't disturbed.
    document.querySelectorAll(".card-like-btn").forEach(btn => {
        const card = btn.closest("[data-song]");
        if (!card) return;
        const song = JSON.parse(card.dataset.song);
        const liked = likedIds.has(song.id);
        btn.classList.toggle("liked", liked);
        btn.textContent = liked ? "♥" : "♡";
    });

    if (currentSong) updateNowPlayingInfo(currentSong);
}

// -----------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------

window.onload = function () {
    loadLikedSongs();
    loadTrending();
    renderMoodGrid();
    initPlayerControls();

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSidebar();
    });
};
/**
 * features.js — Groovo Feature Extensions
 * Load this AFTER player.js and loader.js.
 * All additions are non-destructive patches; original code is never overwritten.
 */

/* ─────────────────────────────────────────────────────────────
   1. TOAST NOTIFICATION HELPER (used by many modules below)
   ───────────────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'groovo-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `groovo-toast groovo-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 320);
    }, 2800);
}


/* ─────────────────────────────────────────────────────────────
   2. SEARCH RESULT CACHE — wraps Search.handleSearch /
      displayResults; zero changes to player.js
   ───────────────────────────────────────────────────────────── */
const SearchCache = {
    _cache: new Map(),
    TTL: 5 * 60 * 1000,   // 5 minutes

    get(query) {
        const key = query.toLowerCase().trim();
        const entry = this._cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > this.TTL) { this._cache.delete(key); return null; }
        return entry.results;
    },

    set(query, results) {
        const key = query.toLowerCase().trim();
        this._cache.set(key, { results, ts: Date.now() });
        if (this._cache.size > 60) this._cache.delete(this._cache.keys().next().value);
    }
};

// Intercept displayResults to cache results
const _origDisplayResults = Search.displayResults.bind(Search);
Search.displayResults = function (results) {
    const query = Elements.search.input?.value.trim();
    if (query && Array.isArray(results) && results.length) SearchCache.set(query, results);
    _origDisplayResults(results);
};

// Intercept handleSearch to serve cache hits instantly
const _origHandleSearch = Search.handleSearch.bind(Search);
Search.handleSearch = async function () {
    const query = Elements.search.input?.value.trim();
    if (!query) { _origHandleSearch(); return; }
    const cached = SearchCache.get(query);
    if (cached) {
        Elements.search.trending.style.display = 'none';
        document.getElementById('moodPlaylistsContainer').style.display = 'none';
        Elements.search.results.style.display = 'block';
        // Show skeleton briefly for UX continuity, then render instantly
        Search.displayResults(cached);
        console.log(`[SearchCache] Instant hit for "${query}"`);
        return;
    }
    await _origHandleSearch();
};


/* ─────────────────────────────────────────────────────────────
   3. RECENTLY PLAYED — localStorage, max 10 songs
   ───────────────────────────────────────────────────────────── */
const RecentlyPlayed = {
    KEY: 'groovo_recently_played',
    MAX: 10,

    add(song) {
        if (!song?.url) return;
        try {
            const list = this.get().filter(s => s.url !== song.url);
            list.unshift({ url: song.url, title: song.title, thumbnail: song.thumbnail, artist: song.artist });
            localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, this.MAX)));
            this.render();
        } catch (_) {}
    },

    get() {
        try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (_) { return []; }
    },

    render() {
        const section   = document.getElementById('recentlyPlayedSection');
        const container = document.getElementById('recentlyPlayedList');
        if (!section || !container) return;
        const list = this.get();
        if (!list.length) { section.style.display = 'none'; return; }
        section.style.display = '';
        container.innerHTML = '';
        list.forEach(song => {
            if (typeof createSongCard === 'function') {
                container.appendChild(createSongCard(song));
            }
        });
    }
};

// Patch Player.play to record recently played after a successful play
const _origPlay = Player.play.bind(Player);
Player.play = async function (url, title, thumbnail, artist) {
    await _origPlay(url, title, thumbnail, artist);
    if (PlayerState.currentSong) RecentlyPlayed.add(PlayerState.currentSong);
};


/* ─────────────────────────────────────────────────────────────
   4. QUEUE PERSISTENCE — extends saveState / loadState
   ───────────────────────────────────────────────────────────── */
const _origSaveState = Player.saveState.bind(Player);
Player.saveState = function () {
    _origSaveState();
    try {
        const q = PlayerState.queue;
        if (!q || !q.length) return;
        localStorage.setItem('groovo_queue', JSON.stringify({
            queue:        Array.from(q).slice(0, 100),
            queueType:    q.type || null,
            currentIndex: PlayerState.currentIndex,
            ts:           Date.now()
        }));
    } catch (_) {}
};

const _origLoadState = Player.loadState.bind(Player);
Player.loadState = function () {
    _origLoadState();
    try {
        const raw = localStorage.getItem('groovo_queue');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (Date.now() - data.ts > 86_400_000) return; // older than 24h — discard
        if (!Array.isArray(data.queue) || !data.queue.length) return;
        PlayerState.queue        = data.queue;
        PlayerState.queue.type   = data.queueType || undefined;
        PlayerState.currentIndex = data.currentIndex || 0;
        console.log(`[Queue] Restored ${data.queue.length} songs`);
    } catch (_) {}
};


/* ─────────────────────────────────────────────────────────────
   5. SLEEP TIMER
   ───────────────────────────────────────────────────────────── */
const SleepTimer = {
    _timerId:    null,
    _countdownId: null,
    endTime:     null,

    set(minutes) {
        this.clear();
        if (!minutes) return;
        const ms = minutes * 60_000;
        this.endTime  = Date.now() + ms;
        this._timerId = setTimeout(() => {
            PlayerState.audio.pause();
            PlayerState.isPlaying = false;
            Player.updateAllPlayButtons();
            this._timerId = null;
            this.endTime  = null;
            clearInterval(this._countdownId);
            this._updateUI();
            showToast('😴 Sleep timer — music paused', 'info');
        }, ms);
        this._countdownId = setInterval(() => this._updateUI(), 15_000);
        this._updateUI();
    },

    clear() {
        if (this._timerId)    clearTimeout(this._timerId);
        if (this._countdownId) clearInterval(this._countdownId);
        this._timerId = this._countdownId = null;
        this.endTime  = null;
        this._updateUI();
    },

    isActive() { return !!this._timerId; },

    _updateUI() {
        const btn   = document.getElementById('sleepTimerBtn');
        const label = document.getElementById('sleepTimerLabel');
        if (!btn) return;
        if (this.endTime) {
            const mins = Math.max(0, Math.round((this.endTime - Date.now()) / 60_000));
            btn.classList.add('active');
            if (label) label.textContent = `${mins}m`;
        } else {
            btn.classList.remove('active');
            if (label) label.textContent = '';
        }
    }
};

function toggleSleepTimerPanel() {
    const panel = document.getElementById('sleepTimerPanel');
    if (!panel) return;
    const open = panel.style.display !== 'none';
    // Close EQ panel if open
    const eq = document.getElementById('equalizerPanel');
    if (eq) eq.style.display = 'none';
    panel.style.display = open ? 'none' : 'block';
}

function setSleepTimer(minutes) {
    if (minutes === 0) {
        SleepTimer.clear();
        showToast('⏰ Sleep timer cancelled', 'info');
    } else {
        SleepTimer.set(minutes);
        showToast(`⏰ Sleep timer set for ${minutes} min`, 'success');
    }
    const panel = document.getElementById('sleepTimerPanel');
    if (panel) panel.style.display = 'none';
}


/* ─────────────────────────────────────────────────────────────
   6. OFFLINE DETECTION BANNER
   ───────────────────────────────────────────────────────────── */
const OfflineDetector = {
    init() {
        window.addEventListener('offline', () => {
            this._show();
            showToast('📶 No internet connection', 'warning');
        });
        window.addEventListener('online', () => {
            this._hide();
            showToast('✅ Back online', 'success');
        });
        if (!navigator.onLine) this._show();
    },
    _show() {
        const b = document.getElementById('offlineBanner');
        if (b) b.classList.add('show');
    },
    _hide() {
        const b = document.getElementById('offlineBanner');
        if (!b) return;
        b.classList.add('fade-out');
        setTimeout(() => b.classList.remove('show', 'fade-out'), 400);
    }
};


/* ─────────────────────────────────────────────────────────────
   7. EQUALIZER  (Web Audio API — biquad peaking filters)
      Initialised lazily on first use to respect autoplay policy
   ───────────────────────────────────────────────────────────── */
const Equalizer = {
    bands: [
        { freq: 60,    label: '60Hz',  gain: 0 },
        { freq: 230,   label: '230Hz', gain: 0 },
        { freq: 910,   label: '910Hz', gain: 0 },
        { freq: 3600,  label: '3.6k',  gain: 0 },
        { freq: 14000, label: '14kHz', gain: 0 },
    ],
    ctx: null, filters: [], _ready: false,

    init() {
        if (this._ready) return true;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            const src = this.ctx.createMediaElementSource(PlayerState.audio);
            let prev = src;
            this.filters = this.bands.map(b => {
                const f = this.ctx.createBiquadFilter();
                f.type = 'peaking'; f.frequency.value = b.freq;
                f.gain.value = 0; f.Q.value = 1.4;
                prev.connect(f); prev = f;
                return f;
            });
            prev.connect(this.ctx.destination);
            this._ready = true;
            console.log('[EQ] Initialised');
            return true;
        } catch (e) {
            console.warn('[EQ] Init failed:', e);
            return false;
        }
    },

    setGain(i, value) {
        if (!this._ready && !this.init()) return;
        if (this.filters[i]) { this.filters[i].gain.value = value; this.bands[i].gain = value; }
    },

    reset() { this.bands.forEach((_, i) => this.setGain(i, 0)); this._syncPanel(); },

    applyPreset(name) {
        const P = {
            flat:   [0,  0,  0,  0,  0],
            bass:   [8,  5,  0, -2, -3],
            treble: [-3, -1,  0,  4,  7],
            vocal:  [-2,  3,  5,  3, -1],
            pop:    [-1,  3,  4,  3, -1],
            rock:   [5,   3, -1,  3,  5],
        };
        if (!P[name]) return;
        P[name].forEach((g, i) => this.setGain(i, g));
        this._syncPanel();
        showToast(`🎚️ EQ preset: ${name}`, 'info');
    },

    _syncPanel() {
        this.bands.forEach((b, i) => {
            const s = document.getElementById(`eqBand${i}`);
            const l = document.getElementById(`eqVal${i}`);
            if (s) s.value = b.gain;
            if (l) l.textContent = (b.gain >= 0 ? '+' : '') + b.gain + 'dB';
        });
    }
};

function toggleEqualizerPanel() {
    const panel = document.getElementById('equalizerPanel');
    if (!panel) return;
    const open = panel.style.display !== 'none';
    // Close sleep timer panel if open
    const st = document.getElementById('sleepTimerPanel');
    if (st) st.style.display = 'none';
    panel.style.display = open ? 'none' : 'block';
    if (!open) {
        if (Equalizer.ctx?.state === 'suspended') Equalizer.ctx.resume();
        Equalizer._syncPanel();
    }
}

function handleEqSlider(i, val) {
    const g = parseFloat(val);
    Equalizer.setGain(i, g);
    const l = document.getElementById(`eqVal${i}`);
    if (l) l.textContent = (g >= 0 ? '+' : '') + g.toFixed(0) + 'dB';
}


/* ─────────────────────────────────────────────────────────────
   8. CROSSFADE  (volume-ramp approach — no second audio element
      needed; smooth on song-switch)
   ───────────────────────────────────────────────────────────── */
const CrossfadeEngine = {
    duration: 2000,  // ms
    enabled:  false,
    _rampId:  null,

    _ramp(from, to, onDone) {
        clearInterval(this._rampId);
        const STEPS    = 25;
        const stepTime = this.duration / STEPS;
        const stepSize = (to - from) / STEPS;
        let count = 0;
        this._rampId = setInterval(() => {
            count++;
            PlayerState.audio.volume = Math.min(1, Math.max(0, from + stepSize * count));
            if (count >= STEPS) { clearInterval(this._rampId); onDone?.(); }
        }, stepTime);
    },

    fadeOut(onDone) {
        if (!this.enabled || PlayerState.audio.paused) { onDone?.(); return; }
        this._ramp(PlayerState.audio.volume, 0, onDone);
    },

    fadeIn() {
        this._ramp(0, PlayerState.volume, null);
    },

    toggle() {
        this.enabled = !this.enabled;
        const btn = document.getElementById('crossfadeBtn');
        if (btn) btn.classList.toggle('active', this.enabled);
        showToast(this.enabled ? '🌊 Crossfade ON' : '🌊 Crossfade OFF', 'info');
    }
};

// Patch setupAudioPlayback to support crossfade
const _origSetup = Player.setupAudioPlayback.bind(Player);
Player.setupAudioPlayback = async function (audioUrl, duration) {
    if (CrossfadeEngine.enabled && PlayerState.isPlaying) {
        await new Promise(resolve => CrossfadeEngine.fadeOut(resolve));
    }
    await _origSetup(audioUrl, duration);
    if (CrossfadeEngine.enabled) CrossfadeEngine.fadeIn();
};


/* ─────────────────────────────────────────────────────────────
   9. KEYBOARD SHORTCUTS
   Space = play/pause  |  ← = -10s  |  → = +10s  |  M = mute
   N = next  |  P = prev  |  L = like current song
   ───────────────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const settingsOpen = document.getElementById('settingsOverlay')?.classList.contains('show');
    if (settingsOpen) return;

    const audio = PlayerState.audio;

    switch (e.code) {
        case 'Space':
            if (!PlayerState.currentSong) return;
            e.preventDefault();
            PlaybackControls.togglePlayPause();
            break;

        case 'ArrowLeft':
            if (!audio || isNaN(audio.duration)) return;
            e.preventDefault();
            audio.currentTime = Math.max(0, audio.currentTime - 10);
            showToast('⏪ −10s', 'info');
            break;

        case 'ArrowRight':
            if (!audio || isNaN(audio.duration)) return;
            e.preventDefault();
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
            showToast('⏩ +10s', 'info');
            break;

        case 'KeyM':
            e.preventDefault();
            {
                const next = PlayerState.volume === 0 ? 1 : 0;
                updateVolumeControls(next);
                showToast(next === 0 ? '🔇 Muted' : '🔊 Unmuted', 'info');
            }
            break;

        case 'KeyN':
            if (PlayerState.queue?.length) { e.preventDefault(); PlaybackControls.playNext(); }
            break;

        case 'KeyP':
            if (PlayerState.queue?.length) { e.preventDefault(); PlaybackControls.playPrevious(); }
            break;

        case 'KeyL':
            if (PlayerState.currentSong) {
                e.preventDefault();
                Library.toggleLike(PlayerState.currentSong);
            }
            break;
    }
});


/* ─────────────────────────────────────────────────────────────
   10. CLOSE PANELS ON OUTSIDE CLICK
   ───────────────────────────────────────────────────────────── */
document.addEventListener('click', e => {
    const panels = ['sleepTimerPanel', 'equalizerPanel'];
    panels.forEach(id => {
        const panel = document.getElementById(id);
        const btn   = document.getElementById(
            id === 'sleepTimerPanel' ? 'sleepTimerBtn' : 'eqBtn'
        );
        if (!panel || panel.style.display === 'none') return;
        if (!panel.contains(e.target) && !btn?.contains(e.target)) {
            panel.style.display = 'none';
        }
    });
});


/* ─────────────────────────────────────────────────────────────
   11. INIT ALL FEATURES ON DOM READY
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    OfflineDetector.init();
    RecentlyPlayed.render();
});
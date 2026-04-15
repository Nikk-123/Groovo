/**
 * features.js — Groovo Feature Extensions
 * Load this AFTER player.js and loader.js.
 *
 * FIXES vs v1:
 *  - EQ:        ctx.resume() called after wiring; graph initialised on first
 *               play (real user gesture) so context is never stuck 'suspended'.
 *               setGain also calls _ensureRunning() so adjusting a slider cannot
 *               leave the context suspended.
 *  - Crossfade: PlayerState.volume temporarily set to 0 before _origSetup runs,
 *               so the new audio element starts silent. Restored + ramp-up after.
 *               This prevents the "instant full volume then jump to 0" glitch.
 *  - Sleep Timer: Player.updateUIState(url) now called after pause so every
 *               song-card icon flips back to ▶. Countdown uses ceil() not round()
 *               so it never shows 0 while there's still a minute left.
 */

/* ─────────────────────────────────────────────────────────────
   1. TOAST NOTIFICATION HELPER
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
   2. SEARCH RESULT CACHE
   ───────────────────────────────────────────────────────────── */
const SearchCache = {
    _cache: new Map(),
    TTL: 5 * 60 * 1000,

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

const _origDisplayResults = Search.displayResults.bind(Search);
Search.displayResults = function (results) {
    const query = Elements.search.input?.value.trim();
    if (query && Array.isArray(results) && results.length) SearchCache.set(query, results);
    _origDisplayResults(results);
};

const _origHandleSearch = Search.handleSearch.bind(Search);
Search.handleSearch = async function () {
    const query = Elements.search.input?.value.trim();
    if (!query) { _origHandleSearch(); return; }
    const cached = SearchCache.get(query);
    if (cached) {
        Elements.search.trending.style.display = 'none';
        document.getElementById('moodPlaylistsContainer').style.display = 'none';
        Elements.search.results.style.display = 'block';
        Search.displayResults(cached);
        console.log(`[SearchCache] Instant hit for "${query}"`);
        return;
    }
    await _origHandleSearch();
};


/* ─────────────────────────────────────────────────────────────
   3. RECENTLY PLAYED
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
            if (typeof createSongCard === 'function') container.appendChild(createSongCard(song));
        });
        // Wire up 3-dot horizontal scroll behaviour, same as mood/trending sections
        if (typeof initMoodScrollDots === 'function') {
            initMoodScrollDots(container);
        }
    }
};

const _origPlay = Player.play.bind(Player);
Player.play = async function (url, title, thumbnail, artist) {
    await _origPlay(url, title, thumbnail, artist);
    if (PlayerState.currentSong) {
        RecentlyPlayed.add(PlayerState.currentSong);
        MediaSession.update(PlayerState.currentSong);
        // Ensure AudioContext keeps running after each play (user gesture context)
        Equalizer._ensureRunning();
    }
};


/* ─────────────────────────────────────────────────────────────
   4. QUEUE PERSISTENCE
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
        if (Date.now() - data.ts > 86_400_000) return;
        if (!Array.isArray(data.queue) || !data.queue.length) return;
        PlayerState.queue        = data.queue;
        PlayerState.queue.type   = data.queueType || undefined;
        PlayerState.currentIndex = data.currentIndex || 0;
        console.log(`[Queue] Restored ${data.queue.length} songs`);
    } catch (_) {}
};


/* ─────────────────────────────────────────────────────────────
   5. SLEEP TIMER
   FIX: Player.updateUIState(url) called after pause so every
   song-card in every list flips back to the ▶ icon.
   FIX: All timer IDs cleared atomically before any audio change.
   FIX: ceil() so label never shows "0m" with time remaining.
   ───────────────────────────────────────────────────────────── */
const SleepTimer = {
    _timerId:     null,
    _countdownId: null,
    endTime:      null,

    set(minutes) {
        this.clear();
        if (!minutes) return;
        const ms      = minutes * 60_000;
        this.endTime  = Date.now() + ms;

        this._timerId = setTimeout(() => {
            // ── Clear all timer references first ──────────────────
            this._timerId    = null;
            this.endTime     = null;
            clearInterval(this._countdownId);
            this._countdownId = null;

            // ── Pause playback ────────────────────────────────────
            if (!PlayerState.audio.paused) {
                PlayerState.audio.pause();
            }
            PlayerState.isPlaying = false;

            // ── Update EVERY UI surface that shows play/pause ─────
            const currentUrl = PlayerState.currentSong?.url || null;

            // 1. Mini player + expanded player play buttons
            Player.updateAllPlayButtons(currentUrl);

            // 2. Song-card icons in trending / mood / search lists
            //    (without this call they stay stuck on the ⏸ icon)
            if (currentUrl) {
                Player.updateUIState(currentUrl);
            }

            // 3. Sleep timer button label
            this._updateUI();

            showToast('😴 Sleep timer — music paused', 'info');
        }, ms);

        // Refresh the countdown label every 60 s
        this._countdownId = setInterval(() => this._updateUI(), 60_000);
        this._updateUI();
    },

    clear() {
        if (this._timerId)     clearTimeout(this._timerId);
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
            // ceil so we never prematurely show "0m" while seconds remain
            const mins = Math.max(0, Math.ceil((this.endTime - Date.now()) / 60_000));
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
    const eq   = document.getElementById('equalizerPanel');
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
   5b. EQUALIZER PANEL TOGGLE + SLIDER HANDLER
   Called directly from dashboard.html onclick attributes.
   ───────────────────────────────────────────────────────────── */
function toggleEqualizerPanel() {
    const panel = document.getElementById('equalizerPanel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    // Close sleep timer panel if open
    const sleepPanel = document.getElementById('sleepTimerPanel');
    if (sleepPanel) sleepPanel.style.display = 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    // Init EQ when panel first opens so sliders are live immediately.
    // If no song is loaded yet, init() will succeed (graph wires to the element)
    // and audio will flow through when a song is played next.
    if (!isOpen && !Equalizer._ready) {
        Equalizer.init();
    }
}

function handleEqSlider(index, rawValue) {
    const gain = parseFloat(rawValue);
    Equalizer.setGain(index, gain);
    const label = document.getElementById(`eqVal${index}`);
    if (label) label.textContent = (gain >= 0 ? '+' : '') + gain + 'dB';
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
   7. EQUALIZER (FIXED)
   ───────────────────────────────────────────────────────────── */
const Equalizer = {
    bands: [
        { freq: 60,    label: '60Hz',  gain: 0 },
        { freq: 230,   label: '230Hz', gain: 0 },
        { freq: 910,   label: '910Hz', gain: 0 },
        { freq: 3600,  label: '3.6k',  gain: 0 },
        { freq: 14000, label: '14kHz', gain: 0 },
    ],
    ctx: null,
    filters: [],
    masterGain: null,   // ← NEW: controls overall volume
    _ready: false,

    init() {
        if (this._ready) return true;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            const src = this.ctx.createMediaElementSource(PlayerState.audio);

            // Build filter chain
            let prev = src;
            this.filters = this.bands.map(b => {
                const f = this.ctx.createBiquadFilter();
                f.type = 'peaking';
                f.frequency.value = b.freq;
                f.gain.value = 0;
                f.Q.value = 1.4;
                prev.connect(f);
                prev = f;
                return f;
            });

            // ← MASTER GAIN FOR VOLUME + CROSSFADE
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = PlayerState.volume || 1.0;
            prev.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            // NOTE: Do NOT set PlayerState.audio.volume = 0 here.
            // createMediaElementSource already re-routes the element's output
            // exclusively into the Web Audio graph — there is no double sound.
            // Setting audio.volume = 0 would silence the signal feeding INTO
            // the graph and make masterGain useless.
            // audio.volume stays at PlayerState.volume (set by setupAudioPlayback).

            // Resume context — safe to call here because init() is always triggered
            // from a user gesture (EQ panel open or setGain from a slider).
            this.ctx.resume()
                .then(() => console.log('[EQ] AudioContext running'))
                .catch(console.warn);

            this._ready = true;
            console.log('[EQ] Graph wired with master gain');
            return true;
        } catch (e) {
            console.warn('[EQ] Init failed:', e.message);
            return false;
        }
    },

    _ensureRunning() {
        if (this.ctx && this.ctx.state !== 'running') {
            this.ctx.resume().catch(() => {});
        }
    },

    setGain(i, value) {
        if (!this._ready && !this.init()) return;
        this._ensureRunning();
        if (this.filters[i]) {
            this.filters[i].gain.value = value;
            this.bands[i].gain = value;   // keep bands[] in sync so _syncPanel works
        }
    },

    setMasterVolume(value) {   // ← NEW
        if (!this.masterGain) return;
        this.masterGain.gain.value = Math.min(1, Math.max(0, value));
    },

    reset() {
        this.bands.forEach((b, i) => {
            b.gain = 0;
            this.setGain(i, 0);
        });
        this.setMasterVolume(PlayerState.volume || 1.0);
        this._syncPanel();
        showToast('🎚️ EQ reset to flat', 'info');
    },

    applyPreset(name) {
        // [60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz] gains in dB
        const PRESETS = {
            bass:   [  8,  6,  2,  0,  0 ],
            treble: [  0,  0,  2,  5,  8 ],
            vocal:  [ -2,  0,  4,  4,  1 ],
            pop:    [ -1,  3,  5,  3, -1 ],
            rock:   [  5,  3, -1,  3,  5 ],
        };
        const gains = PRESETS[name];
        if (!gains) return;
        gains.forEach((g, i) => this.setGain(i, g));
        this._syncPanel();
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        showToast(`🎚️ EQ: ${label}`, 'success');
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

/* ─────────────────────────────────────────────────────────────
   8. CROSSFADE (FIXED — correct timing, atomic ramps, proper async flow)
   ───────────────────────────────────────────────────────────── */
const CrossfadeEngine = {
    duration: 2000,   // 2 seconds (was wrongly set to 10 000 ms)
    enabled: false,
    _rampId: null,
    _suppressVolumeRestore: false,   // true while a crossfade play() call is in flight

    _ensureEQ() {
        // Only init if we already have a running AudioContext — avoid creating
        // one in an async callback where there may be no user-gesture token.
        if (window.Equalizer && Equalizer._ready) {
            Equalizer._ensureRunning();
        }
    },

    /**
     * Smoothly ramp the master volume from startVol → endVol over `this.duration` ms.
     * Any in-progress ramp is cancelled atomically before the new one starts.
     * @param {number}   startVol  0–1
     * @param {number}   endVol    0–1
     * @param {Function} [onDone]  called once the ramp finishes
     */
    _ramp(startVol, endVol, onDone) {
        // Cancel any currently running ramp first
        if (this._rampId !== null) {
            clearInterval(this._rampId);
            this._rampId = null;
        }

        const STEPS    = 40;                            // smoother than 50 at 2 s
        const stepMs   = this.duration / STEPS;         // ~50 ms per step
        const stepSize = (endVol - startVol) / STEPS;
        let   count    = 0;

        this._rampId = setInterval(() => {
            count++;
            const vol = Math.max(0, Math.min(1, startVol + stepSize * count));

            if (window.Equalizer && Equalizer.masterGain) {
                Equalizer.masterGain.gain.value = vol;
            } else {
                // Fallback: drive html5 audio volume directly
                try { PlayerState.audio.volume = vol; } catch (_) {}
            }

            if (count >= STEPS) {
                clearInterval(this._rampId);
                this._rampId = null;
                onDone?.();
            }
        }, stepMs);
    },

    /**
     * Fade current audio out to 0, then call onDone.
     * If crossfade is disabled, onDone is called immediately.
     * If the audio is already at/near 0 (e.g. song just ended), skip the ramp
     * and call onDone right away to avoid a pointless multi-second wait.
     */
    fadeOut(onDone) {
        if (!this.enabled) return onDone?.();

        // Determine current volume level
        let current = 0;
        if (window.Equalizer && Equalizer.masterGain) {
            current = Equalizer.masterGain.gain.value;
        } else {
            current = PlayerState.audio.volume;
        }

        // If already silent (song ended naturally), skip the fade
        if (current < 0.02) {
            this._ensureEQ();
            return onDone?.();
        }

        this._ensureEQ();
        this._ramp(current, 0, onDone);
    },

    /**
     * Fade the new audio in from 0 → targetVolume.
     * Silences the output first so the new song can't burst through at full
     * volume before the ramp begins.
     */
    fadeIn(targetVolume) {
        const target = targetVolume ?? PlayerState.volume ?? 1;

        // Force-silence before ramping up
        if (window.Equalizer && Equalizer.masterGain) {
            Equalizer.masterGain.gain.value = 0;
        } else {
            try { PlayerState.audio.volume = 0; } catch (_) {}
        }

        this._ensureEQ();
        this._ramp(0, target, () => {
            // Sync the volume slider UI to the final value
            if (typeof updateVolumeControls === 'function') {
                updateVolumeControls(target);
            }
        });
    },

    toggle() {
        this.enabled = !this.enabled;
        const btn = document.getElementById('crossfadeBtn');
        if (btn) btn.classList.toggle('active', this.enabled);
        showToast(this.enabled ? '🌊 Crossfade ON (2s)' : '🌊 Crossfade OFF', 'info');
    }
};

/* ─────────────────────────────────────────────────────────────
   CROSSFADE INTEGRATION
   Key fix: await Player.play() before calling fadeIn, so the
   ramp-up starts only when the new audio is actually playing —
   not while the network fetch is still in progress.
   ───────────────────────────────────────────────────────────── */

// Hook into playNext
const _origPlayNext = PlaybackControls.playNext;
PlaybackControls.playNext = async function (isAuto = false) {
    if (!CrossfadeEngine.enabled || !PlayerState.currentSong) {
        return _origPlayNext.call(this, isAuto);
    }

    // Capture `this` for use inside the callback
    const self = this;
    CrossfadeEngine.fadeOut(async () => {
        CrossfadeEngine._suppressVolumeRestore = true;
        await _origPlayNext.call(self, isAuto);
        CrossfadeEngine._suppressVolumeRestore = false;
        // Only fade in if a new song actually started playing
        if (PlayerState.isPlaying) {
            CrossfadeEngine.fadeIn();
        }
    });
};

// Hook into playPrevious
const _origPlayPrevious = PlaybackControls.playPrevious;
PlaybackControls.playPrevious = async function () {
    if (!CrossfadeEngine.enabled || !PlayerState.currentSong) {
        return _origPlayPrevious.call(this);
    }

    const self = this;
    CrossfadeEngine.fadeOut(async () => {
        CrossfadeEngine._suppressVolumeRestore = true;
        await _origPlayPrevious.call(self);
        CrossfadeEngine._suppressVolumeRestore = false;
        if (PlayerState.isPlaying) {
            CrossfadeEngine.fadeIn();
        }
    });
};

// Hook into manual song selection (clicking any song card)
const _origTogglePlayPause = Player.togglePlayPause;
Player.togglePlayPause = async function (url, title, thumbnail, artist) {
    // Only crossfade when switching to a *different* song, not toggling play/pause
    if (CrossfadeEngine.enabled &&
        PlayerState.currentSong &&
        PlayerState.currentSong.url !== url) {

        const self = this;
        CrossfadeEngine.fadeOut(async () => {
            CrossfadeEngine._suppressVolumeRestore = true;
            await _origTogglePlayPause.call(self, url, title, thumbnail, artist);
            CrossfadeEngine._suppressVolumeRestore = false;
            // Fade in only if the new song actually started
            if (PlayerState.isPlaying) {
                CrossfadeEngine.fadeIn();
            }
        });
        return;
    }
    return _origTogglePlayPause.call(this, url, title, thumbnail, artist);
};


/* ─────────────────────────────────────────────────────────────
   9. KEYBOARD SHORTCUTS
   ───────────────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (document.getElementById('settingsOverlay')?.classList.contains('show')) return;

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
            if (PlayerState.currentSong) { e.preventDefault(); Library.toggleLike(PlayerState.currentSong); }
            break;
    }
});


/* ─────────────────────────────────────────────────────────────
   10. CLOSE PANELS ON OUTSIDE CLICK
   ───────────────────────────────────────────────────────────── */
document.addEventListener('click', e => {
    [
        { panelId: 'sleepTimerPanel', btnId: 'sleepTimerBtn' },
        { panelId: 'equalizerPanel',  btnId: 'eqBtn'         },
    ].forEach(({ panelId, btnId }) => {
        const panel = document.getElementById(panelId);
        const btn   = document.getElementById(btnId);
        if (!panel || panel.style.display === 'none') return;
        if (!panel.contains(e.target) && !btn?.contains(e.target)) {
            panel.style.display = 'none';
        }
    });
});


/* ─────────────────────────────────────────────────────────────
   11. MEDIA SESSION API
   Registers OS-level media controls (taskbar, lock screen, headset
   buttons) so the OS knows what's playing and can send prev/next/
   play/pause commands back into the player.
   ───────────────────────────────────────────────────────────── */
const MediaSession = {
    supported: 'mediaSession' in navigator,

    /** Push current song metadata to the OS media overlay */
    update(song) {
        if (!this.supported || !song) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title:  song.title  || 'Unknown Title',
                artist: song.artist || 'Unknown Artist',
                album:  'Groovo',
                artwork: song.thumbnail ? [
                    { src: song.thumbnail, sizes: '512x512', type: 'image/jpeg' }
                ] : []
            });
        } catch (e) {
            console.warn('[MediaSession] metadata update failed:', e);
        }
    },

    /** Wire OS transport buttons → player controls */
    init() {
        if (!this.supported) return;

        const safe = (handler) => {
            try { navigator.mediaSession.setActionHandler(...handler); }
            catch (_) { /* browser may not support this action */ }
        };

        safe(['play',          () => { if (!PlayerState.isPlaying) PlaybackControls.togglePlayPause(); }]);
        safe(['pause',         () => { if (PlayerState.isPlaying)  PlaybackControls.togglePlayPause(); }]);
        safe(['stop',          () => { if (PlayerState.isPlaying)  PlaybackControls.togglePlayPause(); }]);
        safe(['previoustrack', () => PlaybackControls.playPrevious()]);
        safe(['nexttrack',     () => PlaybackControls.playNext()]);
        safe(['seekbackward',  (d) => {
            const skip = d?.seekOffset ?? 10;
            PlayerState.audio.currentTime = Math.max(0, PlayerState.audio.currentTime - skip);
        }]);
        safe(['seekforward', (d) => {
            const skip = d?.seekOffset ?? 10;
            PlayerState.audio.currentTime = Math.min(
                PlayerState.audio.duration || 0,
                PlayerState.audio.currentTime + skip
            );
        }]);

        // Keep playback state in sync with OS overlay
        PlayerState.audio.addEventListener('play',  () => {
            if (this.supported) navigator.mediaSession.playbackState = 'playing';
        });
        PlayerState.audio.addEventListener('pause', () => {
            if (this.supported) navigator.mediaSession.playbackState = 'paused';
        });

        console.log('[MediaSession] OS media controls registered');
    }
};


/* ─────────────────────────────────────────────────────────────
   12. DOM READY INIT
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    OfflineDetector.init();
    RecentlyPlayed.render();
    MediaSession.init();
});
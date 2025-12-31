// Analytics Dashboard JavaScript

let hourlyChart, dailyChart;

// Initialize analytics on page load
document.addEventListener('DOMContentLoaded', function () {
    loadAnalyticsOverview();
    loadListeningPatterns();
    loadTopSongs();
    loadCurrentSessions();

    // Refresh current sessions every 10 seconds
    setInterval(refreshCurrentSessions, 10000);
});

// Load analytics overview
async function loadAnalyticsOverview() {
    try {
        const response = await fetch('/api/analytics/overview');
        const data = await response.json();

        if (data.success) {
            const overview = data.overview;
            document.getElementById('totalPlays').textContent = overview.total_plays.toLocaleString();
            document.getElementById('active24h').textContent = overview.active_24h.toLocaleString();
            document.getElementById('currentlyListening').textContent = overview.currently_listening.toLocaleString();

            // Hide loading spinner
            document.querySelectorAll('.loading-spinner').forEach(el => {
                el.style.display = 'none';
            });
        }
    } catch (error) {
        console.error('Error loading analytics overview:', error);
    }
}

// Load listening patterns and create charts
async function loadListeningPatterns() {
    try {
        const response = await fetch('/api/analytics/listening-patterns');
        const data = await response.json();

        if (data.success) {
            const patterns = data.patterns;

            // Hourly Chart
            const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
            const hourlyLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            const hourlyData = Array.from({ length: 24 }, (_, i) => patterns.hourly[String(i)] || 0);

            if (hourlyChart) hourlyChart.destroy();
            hourlyChart = new Chart(hourlyCtx, {
                type: 'bar',
                data: {
                    labels: hourlyLabels,
                    datasets: [{
                        label: 'Plays',
                        data: hourlyData,
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#9ca3af'
                            },
                            grid: {
                                color: 'rgba(107, 114, 128, 0.2)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#9ca3af'
                            },
                            grid: {
                                color: 'rgba(107, 114, 128, 0.2)'
                            }
                        }
                    }
                }
            });

            // Daily Chart
            const dailyCtx = document.getElementById('dailyChart').getContext('2d');
            const dailyLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dailyData = dailyLabels.map(day => patterns.daily[day] || 0);

            if (dailyChart) dailyChart.destroy();
            dailyChart = new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: dailyLabels,
                    datasets: [{
                        label: 'Plays',
                        data: dailyData,
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#9ca3af'
                            },
                            grid: {
                                color: 'rgba(107, 114, 128, 0.2)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#9ca3af'
                            },
                            grid: {
                                color: 'rgba(107, 114, 128, 0.2)'
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading listening patterns:', error);
    }
}

// Load top songs
async function loadTopSongs() {
    const loading = document.getElementById('topSongsLoading');
    const list = document.getElementById('topSongsList');

    try {
        const response = await fetch('/api/analytics/top-songs?limit=10');
        const data = await response.json();

        loading.classList.add('hidden');

        if (data.success && data.top_songs.length > 0) {
            list.classList.remove('hidden');
            list.innerHTML = data.top_songs.map((song, index) => `
                <div class="song-card p-4 rounded-lg border border-gray-700/50 flex items-center justify-between">
                    <div class="flex items-center space-x-4 flex-1">
                        <div class="text-2xl font-bold text-gray-500">#${index + 1}</div>
                        <img 
                            src="${song.thumbnail || 'https://via.placeholder.com/48'}" 
                            alt="${escapeHtml(song.title)}"
                            class="song-thumbnail"
                            onerror="this.src='https://via.placeholder.com/48?text=No+Image'"
                        />
                        <div class="flex-1 min-w-0">
                            <p class="text-white font-semibold truncate">${escapeHtml(song.title)}</p>
                            <p class="text-gray-400 text-sm truncate">${escapeHtml(song.artist || 'Unknown Artist')}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-6">
                        <div class="text-center">
                            <p class="text-gray-400 text-xs">Plays</p>
                            <p class="text-white font-bold text-lg">${song.play_count}</p>
                        </div>
                        <div class="text-center">
                            <p class="text-gray-400 text-xs">Listeners</p>
                            <p class="text-green-400 font-bold text-lg">${song.unique_listeners}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="text-center text-gray-400 py-8">No data available yet</p>';
            list.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading top songs:', error);
        loading.classList.add('hidden');
        list.innerHTML = '<p class="text-center text-red-400 py-8">Error loading top songs</p>';
        list.classList.remove('hidden');
    }
}

// Load current sessions
async function loadCurrentSessions() {
    const loading = document.getElementById('currentSessionsLoading');
    const list = document.getElementById('currentSessionsList');
    const empty = document.getElementById('currentSessionsEmpty');

    try {
        const response = await fetch('/api/analytics/currently-listening');
        const data = await response.json();

        loading.classList.add('hidden');

        if (data.success && data.sessions.length > 0) {
            list.classList.remove('hidden');
            empty.classList.add('hidden');

            list.innerHTML = data.sessions.map(session => {
                const startTime = new Date(session.started_at);
                const duration = Math.floor((new Date() - startTime) / 1000 / 60); // minutes

                return `
                    <div class="song-card p-4 rounded-lg border border-green-700/50 flex items-center justify-between bg-green-500/5">
                        <div class="flex items-center space-x-4 flex-1">
                            <div class="relative">
                                <img 
                                    src="${session.song.thumbnail || 'https://via.placeholder.com/48'}" 
                                    alt="${escapeHtml(session.song.title)}"
                                    class="song-thumbnail"
                                    onerror="this.src='https://via.placeholder.com/48?text=No+Image'"
                                />
                                <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-white font-semibold truncate">${escapeHtml(session.song.title)}</p>
                                <p class="text-gray-400 text-sm truncate">${escapeHtml(session.song.artist || 'Unknown Artist')}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="text-right">
                                <p class="text-gray-400 text-xs">User</p>
                                <p class="text-white text-sm">${escapeHtml(session.user_email)}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-gray-400 text-xs">Duration</p>
                                <p class="text-green-400 text-sm">${duration}m</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            list.classList.add('hidden');
            empty.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading current sessions:', error);
        loading.classList.add('hidden');
        empty.classList.remove('hidden');
    }
}

// Refresh current sessions
function refreshCurrentSessions() {
    loadCurrentSessions();
}

// Utility function
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

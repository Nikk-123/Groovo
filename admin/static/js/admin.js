// Admin Dashboard JavaScript

// Global variables
let allUsers = [];
let currentUserEmail = null;

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function () {
    loadStatistics();
    loadUsers();
    loadReleaseInfo();

    // Setup search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
});

// Load statistics
async function loadStatistics() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        if (data.success) {
            const stats = data.stats;
            document.getElementById('totalUsers').textContent = stats.total_users.toLocaleString();
            document.getElementById('totalSongs').textContent = stats.total_songs.toLocaleString();
            document.getElementById('avgSongs').textContent = stats.avg_songs_per_user.toFixed(1);

            // Hide loading spinners
            document.querySelectorAll('.loading-spinner').forEach(el => {
                el.style.display = 'none';
            });
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        showError('Failed to load statistics');
    }
}

// Load all users
async function loadUsers(searchQuery = '') {
    const loadingState = document.getElementById('loadingState');
    const tableContainer = document.getElementById('usersTableContainer');
    const emptyState = document.getElementById('emptyState');

    // Show loading
    loadingState.classList.remove('hidden');
    tableContainer.classList.add('hidden');
    emptyState.classList.add('hidden');

    try {
        const url = searchQuery
            ? `/api/users?search=${encodeURIComponent(searchQuery)}`
            : '/api/users';

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            allUsers = data.users;
            displayUsers(allUsers);
        } else {
            showError('Failed to load users');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load users');
    } finally {
        loadingState.classList.add('hidden');
    }
}

// Display users in table
function displayUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    const tableContainer = document.getElementById('usersTableContainer');
    const emptyState = document.getElementById('emptyState');

    if (!users || users.length === 0) {
        tableContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    tableContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    tableBody.innerHTML = users.map(user => `
        <tr class="hover:bg-gray-800/30 transition">
            <td class="py-4 px-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                        ${user.email.charAt(0).toUpperCase()}
                    </div>
                    <span class="text-white font-medium">${escapeHtml(user.email)}</span>
                </div>
            </td>
            <td class="py-4 px-4 text-center">
                <span class="inline-flex items-center justify-center bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-semibold">
                    <i class="fas fa-music mr-2"></i>${user.library_count}
                </span>
            </td>
            <td class="py-4 px-4 text-center">
                ${user.face_auth_enabled
            ? '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>Enabled</span>'
            : '<span class="badge badge-default"><i class="fas fa-times mr-1"></i>Disabled</span>'
        }
            </td>
            <td class="py-4 px-4 text-center">
                <button 
                    onclick="viewUserDetails('${escapeHtml(user.email)}')" 
                    class="action-btn action-btn-view"
                >
                    <i class="fas fa-eye"></i>
                    <span>View Details</span>
                </button>
            </td>
        </tr>
    `).join('');
}

// View user details modal
async function viewUserDetails(email) {
    currentUserEmail = email;
    const modal = document.getElementById('userModal');
    const modalEmail = document.getElementById('modalEmail');
    const modalUserEmail = document.getElementById('modalUserEmail');
    const modalSongCount = document.getElementById('modalSongCount');
    const libraryLoading = document.getElementById('modalLibraryLoading');
    const libraryContent = document.getElementById('modalLibraryContent');
    const libraryEmpty = document.getElementById('modalLibraryEmpty');

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Set email
    modalEmail.textContent = email;
    modalUserEmail.textContent = email;

    // Show loading state
    libraryLoading.classList.remove('hidden');
    libraryContent.classList.add('hidden');
    libraryContent.innerHTML = '';
    libraryEmpty.classList.add('hidden');

    try {
        const response = await fetch(`/api/user/${encodeURIComponent(email)}/library`);
        const data = await response.json();

        if (data.success) {
            const library = data.library;
            modalSongCount.textContent = library.length;

            libraryLoading.classList.add('hidden');

            if (library.length === 0) {
                libraryEmpty.classList.remove('hidden');
            } else {
                libraryContent.classList.remove('hidden');
                libraryContent.innerHTML = library.map((song, index) => `
                    <div class="song-card p-4 rounded-lg border border-gray-700/50 flex items-center space-x-4">
                        <div class="flex-shrink-0">
                            <img 
                                src="${song.thumbnail || 'https://via.placeholder.com/48'}" 
                                alt="${escapeHtml(song.title)}"
                                class="song-thumbnail"
                                onerror="this.src='https://via.placeholder.com/48?text=No+Image'"
                            />
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-white font-semibold truncate">${escapeHtml(song.title)}</p>
                            <p class="text-gray-400 text-sm truncate">${escapeHtml(song.artist || 'Unknown Artist')}</p>
                        </div>
                        <div class="flex-shrink-0 text-gray-400 text-sm">
                            ${song.duration || '-'}
                        </div>
                    </div>
                `).join('');
            }
        } else {
            showError('Failed to load user library');
        }
    } catch (error) {
        console.error('Error loading user details:', error);
        showError('Failed to load user details');
        libraryLoading.classList.add('hidden');
        libraryEmpty.classList.remove('hidden');
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('userModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentUserEmail = null;
}

// Handle search
function handleSearch(event) {
    const searchQuery = event.target.value.trim();
    loadUsers(searchQuery);
}

// Refresh users
function refreshUsers() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    loadUsers();
    loadStatistics();
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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

function showError(message) {
    // Simple error notification (you can enhance this with a toast library)
    console.error(message);
    alert(message);
}

// Load latest GitHub release information
async function loadReleaseInfo() {
    const releaseLoading = document.getElementById('releaseLoading');
    const releaseContent = document.getElementById('releaseContent');
    const releaseError = document.getElementById('releaseError');
    const releaseErrorMessage = document.getElementById('releaseErrorMessage');

    // Show loading state
    releaseLoading.classList.remove('hidden');
    releaseContent.classList.add('hidden');
    releaseError.classList.add('hidden');

    try {
        const response = await fetch('/api/releases/latest');
        const data = await response.json();

        if (data.success && data.release) {
            const release = data.release;

            // Update version
            document.getElementById('releaseVersion').textContent = release.version;

            // Format and display release date
            if (release.published_at) {
                const date = new Date(release.published_at);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                document.getElementById('releaseDate').textContent = formattedDate;
            }

            // Display file size and assets
            const releaseAssets = document.getElementById('releaseAssets');
            releaseAssets.innerHTML = '';

            if (release.assets && release.assets.length > 0) {
                // Show size of first asset
                const firstAsset = release.assets[0];
                const sizeInMB = (firstAsset.size / (1024 * 1024)).toFixed(2);
                document.getElementById('releaseSize').textContent = `${sizeInMB} MB`;

                // Create download buttons for each asset
                release.assets.forEach(asset => {
                    const assetDiv = document.createElement('div');
                    assetDiv.className = 'bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 flex items-center justify-between';
                    assetDiv.innerHTML = `
                        <div class="flex items-center space-x-3">
                            <i class="fas fa-file-download text-green-500 text-2xl"></i>
                            <div>
                                <p class="text-white font-semibold">${escapeHtml(asset.name)}</p>
                                <p class="text-gray-400 text-sm">${(asset.size / (1024 * 1024)).toFixed(2)} MB • Downloaded ${asset.download_count} times</p>
                            </div>
                        </div>
                        <a href="${asset.download_url}" 
                           target="_blank"
                           class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition flex items-center space-x-2">
                            <i class="fas fa-download"></i>
                            <span>Download</span>
                        </a>
                    `;
                    releaseAssets.appendChild(assetDiv);
                });
            } else {
                document.getElementById('releaseSize').textContent = 'N/A';
                releaseAssets.innerHTML = '<p class="text-gray-400 text-center py-4">No executable files available</p>';
            }

            // Show release content
            releaseLoading.classList.add('hidden');
            releaseContent.classList.remove('hidden');
        } else {
            // Show error state
            releaseLoading.classList.add('hidden');
            releaseError.classList.remove('hidden');
            releaseErrorMessage.textContent = data.message || 'Failed to load release information';
        }
    } catch (error) {
        console.error('Error loading release info:', error);
        releaseLoading.classList.add('hidden');
        releaseError.classList.remove('hidden');
        releaseErrorMessage.textContent = 'Failed to connect to server';
    }
}

// Refresh release information
function refreshRelease() {
    loadReleaseInfo();
}


// Close modal when clicking outside
document.addEventListener('click', function (event) {
    const modal = document.getElementById('userModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function (event) {
    // Close modal on Escape key
    if (event.key === 'Escape') {
        const modal = document.getElementById('userModal');
        if (modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    }

    // Focus search on Ctrl+K or Cmd+K
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
        }
    }
});

// Realtime dynamic greeting banner

function computeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Convert "john.doe@gmail.com" → "John.doe", "alice" → "Alice"
 * Strips the domain, then title-cases the first character.
 */
function extractDisplayName(raw) {
  if (!raw) return '';
  const local = raw.split('@')[0].trim();
  if (!local) return '';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function updateGreeting() {
  const el = document.getElementById('greetingText');
  if (!el) return;

  const base = computeGreeting();
  const raw  = el.getAttribute('data-username') || '';
  const name = extractDisplayName(raw);
  el.textContent = name ? `${base}, ${name}` : base;
}

document.addEventListener('DOMContentLoaded', () => {
  updateGreeting();

  // Re-check on the minute boundary so the greeting flips at the right time
  const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
  setTimeout(() => {
    updateGreeting();
    setInterval(updateGreeting, 60_000);
  }, msUntilNextMinute);
});
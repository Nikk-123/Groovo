// Realtime dynamic greeting banner
function computeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function updateGreeting() {
  const el = document.getElementById('greetingText');
  if (!el) return;

  const base = computeGreeting();
  const name = (el.getAttribute('data-username') || '').trim();
  const shownName = name ? `, ${name.split('@')[0]}` : '';
  el.textContent = `${base}${shownName}`;
}

document.addEventListener('DOMContentLoaded', () => {
  updateGreeting();
  // Re-check on the minute to flip at time boundaries
  const msUntilNextMinute = 60000 - (Date.now() % 60000);
  setTimeout(() => {
    updateGreeting();
    setInterval(updateGreeting, 60000);
  }, msUntilNextMinute);
});

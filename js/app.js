/* =========================================================
   Opening Roulette Mobile — app.js
   Home screen, settings, game startup, theme toggle, SW init.
   ========================================================= */

'use strict';

// ── DOM refs ────────────────────────────────────────────────
const homeScreen      = document.getElementById('home-screen');
const gameScreen      = document.getElementById('game-screen');
const spinBtn         = document.getElementById('spin-btn');
const newGameBtn      = document.getElementById('new-game-btn');
const eloSlider       = document.getElementById('elo-slider');
const eloValue        = document.getElementById('elo-value');
const openingFilterEl = document.getElementById('opening-filter');
const nameFilterRow   = document.getElementById('name-filter-row');
const openingNameFilter = document.getElementById('opening-name-filter');

// ── Named openings per family (same as desktop version) ─────
const NAMED_OPENINGS = {
  e4: [
    { label: 'Any e4 opening',       value: '' },
    { label: 'Sicilian Defense',      value: 'Sicilian Defense' },
    { label: 'French Defense',        value: 'French Defense' },
    { label: 'Caro-Kann Defense',     value: 'Caro-Kann Defense' },
    { label: 'Italian Game',          value: 'Italian Game' },
    { label: 'Ruy Lopez',             value: 'Ruy Lopez' },
    { label: 'Scandinavian Defense',  value: 'Scandinavian Defense' },
    { label: "King's Gambit",         value: "King's Gambit" },
    { label: 'Pirc / Modern Defense', value: 'Pirc|Modern Defense' },
  ],
  d4: [
    { label: 'Any d4 opening',         value: '' },
    { label: "Queen's Gambit",         value: "Queen's Gambit" },
    { label: "King's Indian Defense",  value: "King's Indian Defense" },
    { label: 'Nimzo-Indian Defense',   value: 'Nimzo-Indian Defense' },
    { label: "Queen's Indian Defense", value: "Queen's Indian Defense" },
    { label: 'Grünfeld Defense',       value: 'nfeld' },
    { label: 'London System',          value: 'London System' },
    { label: 'Dutch Defense',          value: 'Dutch Defense' },
    { label: 'Catalan Opening',        value: 'Catalan Opening' },
  ],
  flank: [
    { label: 'Any flank opening',    value: '' },
    { label: 'English Opening',      value: 'English Opening' },
    { label: "King's Indian Attack", value: "King's Indian Attack" },
    { label: 'Réti Opening',         value: 'Réti Opening' },
  ],
};

// ── Opening family filter ────────────────────────────────────
openingFilterEl.addEventListener('change', () => {
  const family  = openingFilterEl.value;
  const options = NAMED_OPENINGS[family];

  if (!options) {
    nameFilterRow.classList.add('collapsed');
    openingNameFilter.innerHTML = '';
    updateSpinLabel('');
    return;
  }

  openingNameFilter.innerHTML = options
    .map(o => `<option value="${o.value}">${o.label}</option>`)
    .join('');
  nameFilterRow.classList.remove('collapsed');
  updateSpinLabel('');
});

openingNameFilter.addEventListener('change', () => {
  const sel = openingNameFilter.options[openingNameFilter.selectedIndex];
  updateSpinLabel(sel.value ? sel.textContent : '');
});

function updateSpinLabel(namedLabel) {
  spinBtn.innerHTML = namedLabel
    ? `<span class="spin-icon">⟳</span> New Position — ${namedLabel}`
    : '<span class="spin-icon">⟳</span> New Position';
}

// ── Side selector ────────────────────────────────────────────
document.getElementById('side-selector').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  document.querySelectorAll('#side-selector .seg-btn').forEach(b => b.classList.remove('seg-active'));
  btn.classList.add('seg-active');
});

// ── ELO slider ───────────────────────────────────────────────
eloSlider.addEventListener('input', () => {
  eloValue.textContent = eloSlider.value;
});

// ── New Game button → back to home ───────────────────────────
newGameBtn.addEventListener('click', showHomeScreen);

function showHomeScreen() {
  destroyGame();   // defined in game.js
  gameScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
}

// =========================================================
// GAME START
// =========================================================

spinBtn.addEventListener('click', startGame);

async function startGame() {
  spinBtn.disabled = true;
  spinBtn.innerHTML = '<span class="spin-icon">⟳</span> Loading…';

  // Resolve human color
  const sideEl     = document.querySelector('#side-selector .seg-active');
  const sideChoice = sideEl?.dataset.value ?? 'random';
  const hColor = sideChoice === 'random'
    ? (Math.random() < 0.5 ? 'w' : 'b')
    : (sideChoice === 'black' ? 'b' : 'w');
  const diff = parseInt(eloSlider.value, 10);

  // Load openings (no-op if already cached)
  try {
    await Openings.ensureLoaded();
  } catch (err) {
    alert('Failed to load opening data:\n' + err.message);
    resetSpinBtn();
    return;
  }

  // Pick a random opening
  let data;
  try {
    data = Openings.getRandom(
      openingFilterEl.value,
      document.getElementById('depth-filter').value,
      openingNameFilter.value
    );
  } catch (err) {
    alert('Could not pick an opening:\n' + err.message);
    resetSpinBtn();
    return;
  }

  // Switch to game screen before engine init so the user sees progress
  homeScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  document.getElementById('eco-badge').textContent   = data.eco;
  document.getElementById('opening-name').textContent = data.name;

  // Init Stockfish engine (first time only — subsequent calls are no-ops)
  if (!sfEngine.isReady()) {
    setStatus('Loading Stockfish engine…');
    try {
      await sfEngine.init();
    } catch (err) {
      alert('Failed to load chess engine:\n' + err.message +
            '\n\nCheck your network connection and try again.');
      showHomeScreen();
      resetSpinBtn();
      return;
    }
  }

  // Launch game (theory animation + hand-off)
  await initGame(data, hColor, diff);

  resetSpinBtn();
}

function resetSpinBtn() {
  spinBtn.disabled = false;
  spinBtn.innerHTML = '<span class="spin-icon">⟳</span> New Position';
}

// =========================================================
// THEME TOGGLE
// =========================================================

(function initTheme() {
  const toggles = [
    document.getElementById('theme-toggle'),
    document.getElementById('theme-toggle-game'),
  ];

  const saved   = localStorage.getItem('theme');
  const isLight = saved === 'light';

  if (isLight) {
    document.documentElement.classList.add('light');
    document.body.classList.add('light');
  }
  toggles.forEach(t => { if (t) t.checked = isLight; });

  function applyTheme(light) {
    document.documentElement.classList.toggle('light', light);
    document.body.classList.toggle('light', light);
    localStorage.setItem('theme', light ? 'light' : 'dark');
    toggles.forEach(t => { if (t) t.checked = light; });
  }

  toggles.forEach(t => {
    if (t) t.addEventListener('change', () => applyTheme(t.checked));
  });
}());

// =========================================================
// SERVICE WORKER
// =========================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// =========================================================
// PREVENT BOUNCE SCROLL ON iOS
// =========================================================

// Allow scrolling only inside explicitly scrollable containers
document.addEventListener('touchmove', e => {
  const scrollable = e.target.closest('#home-screen, #move-list, .game-body');
  if (!scrollable) e.preventDefault();
}, { passive: false });

// Prevent context menu on long press (would interfere with drag)
document.addEventListener('contextmenu', e => e.preventDefault());

// =========================================================
// ENGINE PRE-WARM
// =========================================================

// Start loading Stockfish in the background after the home screen
// has had a chance to paint, so WASM compilation doesn't block
// the initial render.  Errors are silently swallowed — if it fails
// here, startGame() will retry and surface any real error to the user.
setTimeout(() => sfEngine.init().catch(() => {}), 100);

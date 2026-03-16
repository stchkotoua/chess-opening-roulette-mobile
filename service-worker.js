/* =========================================================
   Opening Roulette — Service Worker
   Cache-first strategy for full offline support.
   ========================================================= */

'use strict';

const CACHE_NAME = 'opening-roulette-v35';

const PIECE_NAMES = ['wP','wR','wN','wB','wQ','wK','bP','bR','bN','bB','bQ','bK'];

const ASSETS = [
  // Local
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/openings.js',
  './js/pgn.js',
  './js/game.js?v=43',
  './js/app.js',
  // Stockfish — local copies (single-threaded, no SharedArrayBuffer required)
  './js/stockfish.js',
  './js/stockfish.wasm',
  './data/a.tsv',
  './data/b.tsv',
  './data/c.tsv',
  './data/d.tsv',
  './data/e.tsv',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './favicon.ico',
  // Piece images — local copies (avoid CORS issues)
  ...PIECE_NAMES.map(p => `./img/chesspieces/wikipedia/${p}.png`),
  // CDN — jQuery, chess.js, chessboard.js
  'https://code.jquery.com/jquery-3.7.1.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css',
  'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js',
];

// ── Install: pre-cache everything ──────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local assets (always works)
      const local = ASSETS.filter(u => !u.startsWith('http'));
      const cdn   = ASSETS.filter(u =>  u.startsWith('http'));

      return cache.addAll(local).then(() =>
        Promise.allSettled(
          cdn.map(url =>
            fetch(url, { mode: 'cors' })
              .then(res => { if (res.ok || res.type === 'opaque') cache.put(url, res); })
              .catch(() => { /* offline during install — will cache on first use */ })
          )
        )
      );
    })
  );
});

// ── Activate: delete old caches ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first ─────────────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful responses for future offline use
        if (response && (response.ok || response.type === 'opaque')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

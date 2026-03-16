/* =========================================================
   Opening Roulette — openings.js
   Loads + caches ECO TSV data, provides filter + random-pick.
   Replaces the Python backend openings.py entirely.
   ========================================================= */

'use strict';

const Openings = (() => {
  let _cache = null;          // array of {eco, name, pgn} once loaded
  let _loadPromise = null;    // prevents parallel fetches

  // ── First-move sets for family filter ──────────────────────
  const FILTER_MOVES = {
    e4:    new Set(['e4']),
    d4:    new Set(['d4']),
    flank: new Set(['c4','Nf3','g3','b3','f4','b4','Nc3','g4']),
  };

  // ── Parse PGN text → array of SAN strings ──────────────────
  // Strips move numbers (e.g. "1.", "1...") and result tokens.
  function pgnToSans(pgn) {
    return pgn
      .replace(/\{[^}]*\}/g, '')          // remove comments
      .replace(/\([^)]*\)/g, '')          // remove variations
      .replace(/\d+\.\.\./g, '')          // remove "1..." style tokens
      .replace(/\d+\./g, '')              // remove move numbers
      .replace(/1-0|0-1|1\/2-1\/2|\*/g, '') // remove result
      .trim()
      .split(/\s+/)
      .filter(s => s.length > 0);
  }

  // ── Replay PGN with chess.js → {fen, pgn_moves} ────────────
  // Returns the FEN after all moves and the canonicalised SAN list.
  function pgnToFen(pgn) {
    const chess = new Chess();
    const sans = pgnToSans(pgn);
    const played = [];
    for (const san of sans) {
      const result = chess.move(san);
      if (!result) break;          // stop on first illegal move
      played.push(result.san);
    }
    return { fen: chess.fen(), pgn_moves: played };
  }

  // ── Fetch + parse all five TSV files ──────────────────────
  async function _loadAll() {
    const entries = [];
    for (const letter of ['a','b','c','d','e']) {
      const res  = await fetch(`data/${letter}.tsv`);
      const text = await res.text();
      const lines = text.split('\n');
      // First line is header (eco\tname\tpgn), skip it
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        if (parts.length < 3) continue;
        const eco  = parts[0].trim();
        const name = parts[1].trim();
        const pgn  = parts[2].trim();
        if (eco && name && pgn) {
          entries.push({ eco, name, pgn });
        }
      }
    }
    return entries;
  }

  // ── Public: ensure openings are loaded ─────────────────────
  async function ensureLoaded() {
    if (_cache) return;
    if (!_loadPromise) {
      _loadPromise = _loadAll().then(data => { _cache = data; });
    }
    await _loadPromise;
  }

  // ── Public: get a random opening with filters ───────────────
  // filterKey: 'any' | 'e4' | 'd4' | 'flank'
  // depthKey:  'any' | 'shallow' | 'medium' | 'deep'
  // openingName: substring (case-insensitive), may contain '|' for OR
  function getRandom(filterKey = 'any', depthKey = 'any', openingName = '') {
    if (!_cache) throw new Error('Openings not loaded yet');

    const byName = (pool) => {
      if (!openingName) return pool;
      const terms = openingName.split('|').map(t => t.trim().toLowerCase()).filter(Boolean);
      return pool.filter(o => terms.some(t => o.name.toLowerCase().includes(t)));
    };

    const byFamily = (pool) => {
      const allowed = FILTER_MOVES[filterKey];
      if (!allowed) return pool;
      return pool.filter(o => {
        const first = pgnToSans(o.pgn)[0] || '';
        return allowed.has(first);
      });
    };

    const byDepth = (pool) => {
      const n = pgnToSans.bind(null);
      if (depthKey === 'shallow') return pool.filter(o => pgnToSans(o.pgn).length <= 5);
      if (depthKey === 'medium')  return pool.filter(o => { const c = pgnToSans(o.pgn).length; return c >= 6 && c <= 9; });
      if (depthKey === 'deep')    return pool.filter(o => pgnToSans(o.pgn).length >= 10);
      return pool;
    };

    // Pipeline: name → family → depth (with fallbacks)
    let candidates;
    if (openingName) {
      candidates = byDepth(byFamily(byName(_cache)));
      if (!candidates.length) candidates = byDepth(byFamily(_cache)); // broaden: drop name filter
    } else {
      candidates = byDepth(byFamily(_cache));
    }
    if (!candidates.length) candidates = _cache;  // final fallback: all openings

    const opening = candidates[Math.floor(Math.random() * candidates.length)];
    const { fen, pgn_moves } = pgnToFen(opening.pgn);

    return {
      eco:       opening.eco,
      name:      opening.name,
      pgn_moves, // canonicalised SAN array
      fen,       // FEN after all theory moves
    };
  }

  return { ensureLoaded, getRandom };
})();

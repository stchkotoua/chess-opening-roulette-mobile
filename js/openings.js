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
    e4:      new Set(['e4']),
    d4:      new Set(['d4']),
    english: new Set(['c4', 'Nf3']),
    flank:   new Set(['f4','b4','g4','g3','b3','Nc3','h4','a4','f3','e3','d3','Na3','Nh3']),
  };

  // ── Parse opening name into L2 / L3 / L4 hierarchy ─────────
  // Format: "L2: L3, L4"  (colon separates L2; first comma after
  // the colon separates L3 from L4; L4 may itself contain commas)
  function parseName(name) {
    const ci = name.indexOf(':');
    if (ci === -1) return { l2: name.trim(), l3: '', l4: '' };
    const l2   = name.slice(0, ci).trim();
    const rest = name.slice(ci + 1).trim();
    const cj   = rest.indexOf(',');
    if (cj === -1) return { l2, l3: rest.trim(), l4: '' };
    return { l2, l3: rest.slice(0, cj).trim(), l4: rest.slice(cj + 1).trim() };
  }

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
  // l2:  exact L2 name  (e.g. 'Sicilian Defense')
  // l3:  exact L3 name  (e.g. 'Dragon Variation')
  // l4:  exact L4 name  (e.g. 'Yugoslav Attack')
  // Filters are applied as exact matches against the parsed name
  // hierarchy, avoiding false positives from substring matching
  // (e.g. 'Slav Defense' would not match 'Semi-Slav Defense').
  function getRandom(filterKey = 'any', depthKey = 'any', l2 = '', l3 = '', l4 = '') {
    if (!_cache) throw new Error('Openings not loaded yet');

    const byL2 = pool => !l2 ? pool : pool.filter(o => parseName(o.name).l2 === l2);
    const byL3 = pool => !l3 ? pool : pool.filter(o => parseName(o.name).l3 === l3);
    const byL4 = pool => !l4 ? pool : pool.filter(o => parseName(o.name).l4 === l4);

    const byFamily = (pool) => {
      const allowed = FILTER_MOVES[filterKey];
      if (!allowed) return pool;
      return pool.filter(o => {
        const first = pgnToSans(o.pgn)[0] || '';
        return allowed.has(first);
      });
    };

    const byDepth = (pool) => {
      if (depthKey === 'shallow') return pool.filter(o => pgnToSans(o.pgn).length <= 5);
      if (depthKey === 'medium')  return pool.filter(o => { const c = pgnToSans(o.pgn).length; return c >= 6 && c <= 9; });
      if (depthKey === 'deep')    return pool.filter(o => pgnToSans(o.pgn).length >= 10);
      return pool;
    };

    // Pipeline: L4 → L3 → L2 → family → depth (progressive fallback)
    // When l2 is specified, skip byFamily — the category dropdown is navigation only.
    let candidates;
    if (l4) {
      candidates = byDepth(byL4(byL3(byL2(_cache))));
      if (!candidates.length) candidates = byDepth(byL3(byL2(_cache)));           // drop l4
      if (!candidates.length) candidates = byDepth(byL2(_cache));                 // drop l3
      if (!candidates.length) candidates = byDepth(byFamily(_cache));             // drop l2, use family
    } else if (l3) {
      candidates = byDepth(byL3(byL2(_cache)));
      if (!candidates.length) candidates = byDepth(byL2(_cache));                 // drop l3
      if (!candidates.length) candidates = byDepth(byFamily(_cache));             // drop l2, use family
    } else if (l2) {
      candidates = byDepth(byL2(_cache));
      if (!candidates.length) candidates = byDepth(byFamily(_cache));             // drop l2, use family
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

# Opening Roulette — CLAUDE.md

Developer reference for Claude Code and human contributors.

---

## Architecture

Pure static PWA — no build step, no backend, no bundler.
All files are served directly by GitHub Pages (or any static file server).

```
index.html          Shell, DOM structure, script tags
css/style.css       All styles (dark/light theme, layout, animations)
js/app.js           Home screen logic, opening filter data + cascade, game start, SW registration
js/game.js          Board, move handling, history navigation, Stockfish engine wrapper
js/openings.js      TSV loader and opening picker (Openings namespace)
js/pgn.js           PGN generation, clipboard copy, file export
js/stockfish.js     Stockfish JS loader — nmrugg v18 lite-single (served locally)
js/stockfish.wasm   Stockfish WASM binary — 7.3 MB (served locally)
data/a.tsv … e.tsv  ECO opening database (3,641 entries) split by ECO letter
service-worker.js   Cache-first offline service worker
manifest.json       PWA manifest — scope and start_url must match GH Pages path
icons/              icon-192.png and icon-512.png
img/chesspieces/wikipedia/  Local copies of 12 piece PNGs (avoids CORS)
.nojekyll           Prevents GitHub Pages from running Jekyll
```

---

## Tech Stack

| Library | Version | Source |
|---|---|---|
| jQuery | 3.7.1 | CDN |
| chess.js | 0.10.3 | CDN |
| chessboard.js | 1.0.0 | CDN (unpkg) |
| Stockfish | v18 lite-single WASM | Served locally |
| Piece images | Wikipedia set | Local (`img/chesspieces/wikipedia/`) |

Everything else is vanilla JS (ES2017+), no frameworks, no transpilation.

---

## Opening Filter System

The home screen exposes a 4-level cascading filter, all data derived from the
actual TSV files at a ≥3-entry threshold.

### L1 — Family (opening-filter select)

Five values: `any` | `e4` | `d4` | `english` | `flank`

`openings.js` `FILTER_MOVES` maps these to first-move sets:
- `e4` → `{e4}`
- `d4` → `{d4}`
- `english` → `{c4, Nf3}`  ← new category added
- `flank` → `{f4, b4, g4, g3, b3, Nc3, h4, a4, f3, e3, d3, Na3, Nh3}`

When `l2` (named opening) is specified, `byFamily` is **skipped entirely** —
the category selector is navigation-only and the L2 name uniquely identifies
the pool.

### L2 — Named opening (opening-name-filter select)

`NAMED_OPENINGS` in `app.js` maps each L1 key to an array of items.
e4 and d4 use `<optgroup>` elements (both have ~36 openings):

```js
// Item types supported by buildSelectHTML():
{ value, label }                  // plain <option>
{ optgroup, options: [{...}] }    // <optgroup> wrapping nested options
```

e4 groups: Open Games / Semi-Open Games / Irregular
d4 groups: Queen's Gambit Systems / Indian Defenses / Other Defenses / White Systems
english and flank: flat lists (≤14 openings each)

### L3 — Variation (opening-variation-filter select)

`VARIATIONS` object in `app.js`, keyed by exact L2 name. Populated only when
`VARIATIONS[l2]` exists. Cascade: selecting "Any [opening]" (`value: ''`)
hides and resets L3 and L4.

### L4 — Subvariation (opening-subvar-filter select)

`SUBVARIATIONS` object in `app.js`, keyed by `"L2|L3"` composite string.
Populated only when the composite key exists.

### getRandom() fallback chain

```
l4 → byL4(byL3(byL2()))
   ↘ drop l4 → byL3(byL2())
   ↘ drop l3 → byL2()
   ↘ drop l2 → byFamily()
   ↘ no match → entire _cache
```
All fallbacks also apply the depth filter.

### Spin button label

`updateSpinLabel()` builds the button text from the deepest non-empty filter
selected, e.g. `⟳ New Position — Sicilian Defense: Dragon Variation`.

---

## Input Architecture

### Detection

```js
const isTouchDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
```

UA regex is used instead of `pointer:coarse` or `maxTouchPoints` because both
produce false positives on MacBooks (trackpad registers as coarse).

### Mobile (isTouchDevice === true)

- `draggable: false` passed to chessboard.js to prevent touch interception
- Single `touchend` listener scoped to `#board` handles all tap-to-move
- Square detection: walk DOM from `elementFromPoint` upward until a node has
  class matching `/square-([a-h][1-8])/` (chessboard.js uses CSS classes, not
  `data-square` attributes, on piece/overlay elements)
- `touchSelectedSq` state variable tracks the first tap independently of
  the desktop `selectedSq`
- `e.preventDefault()` on touchend suppresses the synthetic click iOS fires,
  preventing double-handling

### Desktop (isTouchDevice === false)

- `draggable: true` — chessboard.js drag-and-drop callbacks handle moves
- `onDragStart` / `onDrop` / `onSnapEnd` callbacks registered
- `pointerup` listener at document level handles click-to-move (two-tap)
- `_skipClear` flag prevents the document `click` that follows `pointerup`
  from wiping `selectedSq` between tap 1 and tap 2
- `document.addEventListener('click', ...)` gated behind `!isTouchDevice` to
  avoid racing with touchend on iOS

### Castling snap

After `game.move()` returns, both the touch handler and `doEngineMove()` check
the move's `flags` field:

```js
const animate = !move.flags.includes('k') && !move.flags.includes('q');
board.position(game.fen(), animate);
```

Castling (`k` = kingside, `q` = queenside) is snapped instantly (`false`)
instead of animated, because chessboard.js animates both king and rook
simultaneously causing visible lag.

---

## Board Notation

chessboard.js built-in rank/file labels (`.notation-322f9`) are hidden via
`.notation-322f9 { display: none !important }` in `style.css`.

External labels are injected by `renderBoardNotation(boardSize, color)` in
`game.js` after each board initialisation:

### DOM structure built by renderBoardNotation()

```
#board-wrap (flex column, centered)
  └─ #board-notation-wrap  (flex row, width: fit-content, margin: 0 auto)
       ├─ #rank-labels      (14px wide flex column, 8 spans)
       ├─ #board            (the chessboard.js element, moved inside)
       └─ #rank-spacer      (14px wide, balances rank-labels so board centers correctly)
  └─ #file-labels           (flex row, width: --board-size, margin-left: 14px)
```

The 14px `#rank-spacer` on the right mirrors the 14px `#rank-labels` on the
left so `#board-notation-wrap` (which is `width: fit-content`) centers
symmetrically on screen.

`--board-size` is set as a CSS custom property so `#file-labels` can match the
board width exactly.

Labels are orientation-aware: when playing as Black the ranks run 1→8
(top to bottom) and files h→a (left to right).

### Board sizing

```js
const availableHeight = window.innerHeight
  - 56   // header
  - 40   // status + move strip
  - 60   // nav buttons
  - 56   // bottom bar
  - 40   // file labels + padding
  - 20;  // safe area buffer
const boardSize = Math.min(window.innerWidth - 28, availableHeight, 520);
```

`window.innerWidth - 28` accounts for 14px of rank labels on each side.

---

## Stockfish WASM Loading

`js/stockfish.js` is loaded as a real named Worker — `new Worker('./js/stockfish.js')`.

In Worker context, the file derives the WASM URL from `self.location.pathname`
(replacing `.js` with `.wasm`) and fetches it directly. No base64 injection
or Blob Worker trickery needed.

`js/stockfish.wasm` supports `UCI_LimitStrength` / `UCI_Elo` and has no
`SharedArrayBuffer` dependency (no COOP/COEP headers required).

Both files are pre-cached by the service worker for offline use.

**Why not a Blob Worker**: Blob Workers have no base URL, so any relative path
in the WASM loader would fail. The previous injection approach (base64-encoding
the 7.3 MB WASM and injecting it as a string literal) produced a ~9.8 MB
patched source that caused `SyntaxError` at parse time.

---

## Scrollable Layout

`html`, `body`, and `#game-screen` all use `overflow-y: auto` with
`-webkit-overflow-scrolling: touch` so content is accessible on smaller phones
and in landscape orientation.

`.bottom-bar` is `position: fixed` (always was). `#game-screen` has
`padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px))` so content
is never hidden behind the bar.

---

## Service Worker Strategy

- **Install**: pre-cache all local assets via `cache.addAll`; CDN assets fetched
  with `mode: 'cors'` and cached best-effort (silently ignored if offline)
- **Activate**: deletes **all** caches (not just old ones) to guarantee a clean
  slate after any version bump, then calls `clients.claim()`
- **Fetch**: cache-first — serve from cache if available, otherwise network;
  successful network responses are stored in the cache for future offline use
- `skipWaiting()` is called synchronously (before `event.waitUntil`) so the new
  SW activates immediately without waiting for all tabs to close

---

## GitHub Pages Deployment

Repo: `https://github.com/stchkotoua/chess-opening-roulette-mobile`
Live URL: `https://stchkotoua.github.io/chess-opening-roulette-mobile/`

Critical: `manifest.json` must have:
```json
"start_url": "/chess-opening-roulette-mobile/",
"scope":     "/chess-opening-roulette-mobile/"
```

All service worker precache paths must use `./` prefix (not `/`) so they resolve
relative to the subdirectory, not the domain root.

The SW is registered with `./service-worker.js` (relative) so its scope is the
subdirectory, not `/`.

`.nojekyll` at repo root prevents GitHub Pages from ignoring `_`-prefixed files.

---

## Bumping Versions

After any file change, do **both**:

1. **Service worker cache**: increment `CACHE_NAME` in `service-worker.js`
   (e.g. `opening-roulette-v34` → `opening-roulette-v35`). The activate handler
   nukes all old caches so users always get fresh files.

2. **Cache-bust game.js**: update the `?v=` query string in `index.html`:
   ```html
   <script src="js/game.js?v=43"></script>
   ```
   Current version: `game.js?v=43`, SW cache: `opening-roulette-v35`.

---

## Known Limitations

- **Mobile: tap-only** — drag-to-move is not supported on touch devices.
  chessboard.js touch drag was disabled (`draggable: false`) because it
  intercepted touchstart/touchend and broke the custom tap logic.
- **No promotion UI** — pawn promotion always promotes to queen (`promotion: 'q'`).
- **Single game at a time** — no session history or stats tracking.
- **No opening search** — openings are filterable only through the cascade
  dropdowns (family → named opening → variation → subvariation), not free-text.
- **Opening filter is UI-only for category** — when a specific L2 opening is
  selected, the L1 family filter has no effect on which positions are picked;
  it only controls which named openings are shown in the L2 dropdown.

/* =========================================================
   Opening Roulette Mobile — game.js
   Board logic, move handling, Stockfish Web Worker engine.
   ========================================================= */

'use strict';


// ── Shared state (read by pgn.js / app.js) ──────────────────
let fenHistory       = [];
let sanHistory       = [];
let historyIndex     = 0;
let theoryLength     = 0;

let board            = null;
let game             = null;   // chess.js — always at the LIVE position

let humanColor       = 'w';
let difficulty       = 1500;
let selectedSq       = null;
let _skipClear       = false;
let gameActive       = false;
let gameResult       = null;
let currentEco       = '';
let currentOpeningName = '';

// UA-based detection: iPhones/iPads/Android always carry these strings.
// Avoids false positives from pointer:coarse on MacBooks with touch-capable
// trackpads and from maxTouchPoints being non-zero on non-touch laptops.
const isTouchDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// ── DOM refs ────────────────────────────────────────────────
const moveList           = document.getElementById('move-list');
const statusBar          = document.getElementById('status-bar');
const resultBanner       = document.getElementById('result-banner');
const btnBack            = document.getElementById('btn-back');
const btnForward         = document.getElementById('btn-forward');
const btnResign          = document.getElementById('btn-resign');
const resignModal        = document.getElementById('resign-modal');
const btnResignConf      = document.getElementById('btn-resign-confirm');
const btnResignCan       = document.getElementById('btn-resign-cancel');
const movesSheetBackdrop = document.getElementById('moves-sheet-backdrop');

// ── Resign modal wiring ─────────────────────────────────────
btnResign.addEventListener('click', () => {
  if (!gameActive || isReviewing()) return;
  resignModal.classList.remove('hidden');
  btnResignConf.focus();
});

btnResignCan.addEventListener('click', closeResignModal);
btnResignConf.addEventListener('click', () => { closeResignModal(); handleResign(); });
resignModal.addEventListener('click', e => { if (e.target === resignModal) closeResignModal(); });

function closeResignModal() { resignModal.classList.add('hidden'); }

// ── Moves sheet ─────────────────────────────────────────────
document.getElementById('btn-moves-sheet').addEventListener('click', openMovesSheet);
document.getElementById('btn-sheet-close').addEventListener('click', closeMovesSheet);
movesSheetBackdrop.addEventListener('click', e => {
  if (e.target === movesSheetBackdrop) closeMovesSheet();
});

function openMovesSheet() {
  renderMoveList();
  movesSheetBackdrop.classList.remove('hidden');
  // Double rAF gives the browser a frame to paint before animating
  requestAnimationFrame(() => requestAnimationFrame(() => {
    movesSheetBackdrop.classList.add('open');
  }));
}

function closeMovesSheet() {
  movesSheetBackdrop.classList.remove('open');
  movesSheetBackdrop.addEventListener('transitionend', () => {
    movesSheetBackdrop.classList.add('hidden');
  }, { once: true });
}

// ── Nav buttons ─────────────────────────────────────────────
btnBack.addEventListener('click',    () => stepTo(historyIndex - 1));
btnForward.addEventListener('click', () => stepTo(historyIndex + 1));

document.getElementById('btn-export-pgn').addEventListener('click', exportPgn);
document.getElementById('btn-copy-pgn').addEventListener('click', copyPgn);

// ── Keyboard nav (optional, works when using desktop browser too) ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !resignModal.classList.contains('hidden')) {
    closeResignModal(); return;
  }
  if (document.getElementById('game-screen').classList.contains('hidden')) return;
  if (!resignModal.classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); stepTo(historyIndex - 1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); stepTo(historyIndex + 1); }
});

// =========================================================
// STOCKFISH ENGINE
// =========================================================

// Stockfish is loaded by fetching both the JS loader and the WASM binary,
// then injecting the WASM bytes directly into the Blob Worker source.
// This sidesteps all URL-resolution problems: Blob Workers have no base URL,
// so any relative or path-only WASM URL (e.g. "/js/stockfish.wasm") fails.
// By pre-filling `var wasmBinary` in the source, getWasmBinaryPromise()
// takes the synchronous path and never issues a fetch from inside the worker.
const SF_JS   = './js/stockfish.wasm.js';
const SF_WASM = './js/stockfish.wasm';

const sfEngine = (() => {
  let worker   = null;
  let ready    = false;
  let _onReady = null;
  let _onMove  = null;

  function _handle(line) {
    if (typeof line !== 'string') return;

    if (line === 'uciok') {
      worker.postMessage('isready');
    }
    if (line === 'readyok') {
      ready = true;
      if (_onReady) { _onReady(); _onReady = null; }
    }
    if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      const move  = (parts[1] && parts[1] !== '(none)') ? parts[1] : null;
      if (_onMove) { _onMove(move); _onMove = null; }
    }
  }

  async function init() {
    if (ready) return;
    if (worker) { worker.terminate(); worker = null; }

    // Fetch JS loader and WASM binary in parallel.
    // Both go through the service-worker cache for offline support.
    let src, wasmBuffer;
    try {
      [src, wasmBuffer] = await Promise.all([
        fetch(SF_JS).then(r => {
          if (!r.ok) throw new Error('JS HTTP ' + r.status);
          return r.text();
        }),
        fetch(SF_WASM).then(r => {
          if (!r.ok) throw new Error('WASM HTTP ' + r.status);
          return r.arrayBuffer();
        }),
      ]);
    } catch (err) {
      throw new Error('Failed to fetch Stockfish: ' + err.message);
    }

    // Encode WASM bytes as base64 in 8 KB chunks (avoids call-stack overflow
    // from spreading a 558 KB array into String.fromCharCode all at once).
    const wasmBytes = new Uint8Array(wasmBuffer);
    const CHUNK = 8192;
    let binary = '';
    for (let off = 0; off < wasmBytes.length; off += CHUNK) {
      binary += String.fromCharCode.apply(null, wasmBytes.subarray(off, off + CHUNK));
    }
    const wasmBase64 = btoa(binary);

    // Inject the WASM bytes directly into the `var wasmBinary` declaration.
    // When getWasmBinaryPromise() runs it sees a truthy wasmBinary and takes
    // the synchronous getBinary() path — no fetch ever leaves the worker.
    const DECL = 'var wasmBinary,';
    const injected = src.replace(
      DECL,
      `var wasmBinary=Uint8Array.from(atob('${wasmBase64}'),c=>c.charCodeAt(0)),`
    );
    if (injected === src) {
      // Declaration not found — fall back to reporting the problem clearly
      throw new Error(
        'Stockfish source format changed: "var wasmBinary," not found. ' +
        'Re-download js/stockfish.wasm.js from the same CDN source.'
      );
    }

    const blob   = new Blob([injected], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    worker = new Worker(blobUrl);
    worker.onmessage = e => _handle(e.data);
    worker.onerror   = e => { /* worker errors surface as init rejection */ };
    await new Promise((resolve, reject) => {
      // 20 s — WASM compilation can be slow on first run
      const t = setTimeout(
        () => reject(new Error('Stockfish UCI timeout (20 s) — check console for worker errors')),
        20000
      );
      _onReady = () => { clearTimeout(t); resolve(); };
      worker.postMessage('uci');
    });
  }

  function getBestMove(fen, elo) {
    if (!ready) return Promise.resolve(null);
    return new Promise(resolve => {
      _onMove = resolve;
      worker.postMessage('stop');
      worker.postMessage('setoption name UCI_LimitStrength value true');
      worker.postMessage(`setoption name UCI_Elo value ${elo}`);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage('go movetime 1000');
    });
  }

  function cancel() {
    if (worker) worker.postMessage('stop');
    if (_onMove) { _onMove(null); _onMove = null; }
  }

  function isReady() { return ready; }

  return { init, getBestMove, cancel, isReady };
})();

// =========================================================
// GAME INITIALISATION
// =========================================================

const PIECE_THEME = 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png';

/**
 * Initialise a new game from opening data.
 * Called by app.js after the game screen is visible.
 *
 * @param {Object} openingData  {eco, name, pgn_moves, fen}
 * @param {string} hColor       'w' or 'b'
 * @param {number} diff         ELO integer
 */
async function initGame(openingData, hColor, diff) {
  // Cancel any pending engine response from a previous game
  sfEngine.cancel();

  humanColor = hColor;
  difficulty = diff;
  gameActive = false;
  gameResult = null;
  selectedSq = null;
  touchSelectedSq = null;

  currentEco         = openingData.eco;
  currentOpeningName = openingData.name;

  // ── Build theory history from starting position ──────────
  const tempGame = new Chess();
  fenHistory  = [tempGame.fen()];
  sanHistory  = [];
  for (const san of openingData.pgn_moves) {
    const r = tempGame.move(san);
    if (!r) break;
    sanHistory.push(r.san);
    fenHistory.push(tempGame.fen());
  }
  theoryLength = openingData.pgn_moves.length;
  historyIndex = theoryLength;

  // ── Reset UI ─────────────────────────────────────────────
  resultBanner.className = 'hidden';
  document.getElementById('pgn-controls')?.classList.remove('hidden');
  updateNavButtons();

  clearHighlights();

  // ── Init / rebuild board at starting position ────────────
  if (board) { board.destroy(); board = null; }

  // Subtract 20px so chessboard.js rank/file notation labels aren't clipped.
  // The 10px padding added to #board-wrap in CSS accounts for the other 10px.
  const boardSize = Math.min(window.innerWidth, window.screen.width, 480) - 20;
  document.getElementById('board').style.width = boardSize + 'px';

  const boardConfig = {
    position:    'start',
    orientation: humanColor === 'b' ? 'black' : 'white',
    pieceTheme:  PIECE_THEME,
    draggable:   !isTouchDevice,
  };
  if (!isTouchDevice) {
    // Desktop: use chessboard.js drag callbacks for move input.
    boardConfig.onDragStart = onDragStart;
    boardConfig.onDrop      = onDrop;
    boardConfig.onSnapEnd   = onSnapEnd;
  }
  board = Chessboard('board', boardConfig);

  // Re-apply width and ask chessboard.js to recalculate square sizes.
  document.getElementById('board').style.width = boardSize + 'px';
  board.resize();

  // ── Animate theory moves ──────────────────────────────────
  if (openingData.pgn_moves.length > 0) {
    setStatus('Replaying opening theory…');
    const animGame = new Chess();
    for (let i = 0; i < openingData.pgn_moves.length; i++) {
      await delay(380);
      animGame.move(openingData.pgn_moves[i]);
      board.position(animGame.fen(), true);
      // Highlight the current theory position in both strip and sheet list
      renderMoveList(i);
      renderMoveStrip(i);
    }
    await delay(300); // brief pause before game starts
  }

  // ── Live chess.js at the post-theory position ────────────
  game = new Chess(openingData.fen);
  gameActive = true;
  renderMoveList();
  renderMoveStrip();
  updateNavButtons();
  updateReviewMode();

  // Hand off to whoever moves first
  await handOffToPlayers();
}

function destroyGame() {
  sfEngine.cancel();
  gameActive = false;
  selectedSq = null;
  touchSelectedSq = null;
  if (board) { board.destroy(); board = null; }
  moveList.innerHTML = '';
  const stripInner = document.getElementById('move-strip-inner');
  if (stripInner) stripInner.innerHTML = '';
  resultBanner.className = 'hidden';
  closeResignModal();
  btnBack.disabled    = true;
  btnForward.disabled = true;
  setStatus('Waiting…');
}

// =========================================================
// HAND-OFF AFTER THEORY
// =========================================================

async function handOffToPlayers() {
  if (game.turn() !== humanColor) {
    setStatus('Stockfish is thinking…');
    await doEngineMove();
  } else {
    setStatus('Your turn');
  }
}

// =========================================================
// HISTORY MANAGEMENT
// =========================================================

function pushMove(san) {
  sanHistory.push(san);
  fenHistory.push(game.fen());
  historyIndex = fenHistory.length - 1;
  renderMoveList();
  renderMoveStrip();
  updateNavButtons();
  updateReviewMode();
}

function stepTo(index) {
  if (index < 0 || index >= fenHistory.length) return;
  historyIndex = index;
  board.position(fenHistory[index], false);
  clearHighlights();
  selectedSq = null;
  renderMoveList();
  renderMoveStrip();
  updateNavButtons();
  updateReviewMode();
}

function isReviewing() {
  return historyIndex < fenHistory.length - 1;
}

// =========================================================
// MOVE LIST RENDERING
// =========================================================

/**
 * @param {number|null} animIndex  When non-null, highlight this ply
 *                                 during theory animation.
 */
function renderMoveList(animIndex = null) {
  moveList.innerHTML = '';
  const activePly = (animIndex !== null) ? animIndex : historyIndex - 1;

  for (let ply = 0; ply < sanHistory.length; ply += 2) {
    const li  = document.createElement('li');
    const num = document.createElement('span');
    num.className   = 'move-num';
    num.textContent = `${Math.floor(ply / 2) + 1}.`;
    li.appendChild(num);

    // White half-move
    const wSpan = _moveSan(ply, activePly);
    li.appendChild(wSpan);

    // Black half-move (may not exist yet)
    if (sanHistory[ply + 1] !== undefined) {
      li.appendChild(_moveSan(ply + 1, activePly));
    }

    moveList.appendChild(li);
  }

  // Scroll active move into view
  const activeEl = moveList.querySelector('.move-san.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function _moveSan(ply, activePly) {
  const span = document.createElement('span');
  const isBlack  = (ply % 2 === 1);
  const isGame   = (ply >= theoryLength);
  const isActive = (ply === activePly);

  let cls = 'move-san';
  if (isBlack) cls += ' black-move';
  if (isGame)  cls += ' game-move';
  if (isActive) cls += ' active';

  span.className = cls;
  span.setAttribute('data-ply', ply);
  span.textContent = sanHistory[ply];

  // Tap on a move → jump to that position
  span.addEventListener('click', () => stepTo(ply + 1));

  return span;
}

// =========================================================
// MOVE STRIP (horizontal, below board)
// =========================================================

function renderMoveStrip(animIndex = null) {
  const inner = document.getElementById('move-strip-inner');
  if (!inner) return;
  inner.innerHTML = '';
  const activePly = (animIndex !== null) ? animIndex : historyIndex - 1;

  for (let ply = 0; ply < sanHistory.length; ply++) {
    // Move number before each white move
    if (ply % 2 === 0) {
      const n = document.createElement('span');
      n.className = 'strip-num';
      n.textContent = `${Math.floor(ply / 2) + 1}.`;
      inner.appendChild(n);
    }

    const sp = document.createElement('span');
    let cls = 'strip-move';
    if (ply >= theoryLength) cls += ' game-move';
    if (ply === activePly)   cls += ' active';
    sp.className = cls;
    sp.textContent = sanHistory[ply];
    sp.addEventListener('click', () => stepTo(ply + 1));
    inner.appendChild(sp);
  }

  // Scroll the active move to center
  const activeEl = inner.querySelector('.strip-move.active');
  if (activeEl) activeEl.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
}

// =========================================================
// NAV BUTTONS & STATUS
// =========================================================

function updateNavButtons() {
  btnBack.disabled    = historyIndex <= 0;
  btnForward.disabled = historyIndex >= fenHistory.length - 1;
}

function updateReviewMode() {
  const reviewing = isReviewing();
  if (reviewing) {
    setStatus('Review mode — use ◀ ▶ to navigate');
  } else if (gameActive) {
    setStatus(game.turn() === humanColor ? 'Your turn' : 'Stockfish is thinking…');
  }
  updateResignButton();
}

function updateResignButton() {
  const show = gameActive && !isReviewing();
  btnResign.classList.toggle('hidden', !show);
}

function setStatus(msg) { statusBar.textContent = msg; }

// =========================================================
// CHESSBOARD.JS CALLBACKS
// =========================================================

function onDragStart(source, piece) {
  if (!gameActive)      return false;
  if (isReviewing())    return false;
  if (game.game_over()) return false;
  if (humanColor === 'w' && piece.search(/^b/) !== -1) return false;
  if (humanColor === 'b' && piece.search(/^w/) !== -1) return false;
  if (game.turn() !== humanColor) return false;

  if (source === selectedSq) {
    // Re-tap the selected piece → deselect
    clearHighlights();
    selectedSq = null;
    return false;
  }

  selectedSq = source;
  highlightLegal(source);
  return true;
}

function onDrop(source, target) {
  if (source === target) {
    // Tap (zero-distance drag): piece is selected, await destination tap
    return 'snapback';
  }

  // Real drag-to-move
  clearHighlights();
  selectedSq = null;

  const moveResult = game.move({ from: source, to: target, promotion: 'q' });
  if (moveResult === null) return 'snapback';

  pushMove(moveResult.san);
  board.position(game.fen(), false);

  if (game.game_over()) { handleGameOver(); return; }

  setStatus('Stockfish is thinking…');
  setTimeout(doEngineMove, 300);
}

function onSnapEnd() {
  if (selectedSq) {
    // Piece selected, waiting for destination tap — don't touch board
    return;
  }
  board.position(fenHistory[historyIndex], false);
}

// =========================================================
// CLICK-TO-MOVE — pointerup listener
//
// chessboard.js v1.0.0 has no onSquareClick.  We listen for
// pointerup at document level (chessboard.js consumes events
// on #board itself during drag).
//
// _skipClear pattern: pointerup sets _skipClear=true so the
// document 'click' that fires immediately after does NOT
// wipe selectedSq between tap 1 and tap 2.
// =========================================================

document.addEventListener('pointerup', e => {
  _skipClear = true;

  if (!selectedSq) return;
  const squareEl = e.target.closest('[data-square]');
  if (!squareEl) return;       // floating drag piece — let onDrop handle it

  const sq = squareEl.getAttribute('data-square');

  if (sq === selectedSq) {
    // Tapped the same square again → deselect
    clearHighlights();
    selectedSq = null;
    return;
  }

  if (!gameActive || isReviewing()) return;

  const move = game.move({ from: selectedSq, to: sq, promotion: 'q' });
  clearHighlights();
  selectedSq = null;

  if (move) {
    board.move(`${move.from}-${move.to}`);  // animate the piece
    pushMove(move.san);
    if (game.game_over()) { handleGameOver(); return; }
    setStatus('Stockfish is thinking…');
    setTimeout(doEngineMove, 300);
  } else {
    // Illegal destination: if it's a friendly piece, switch selection
    const piece = game.get(sq);
    if (piece && piece.color === humanColor && game.turn() === humanColor) {
      selectedSq = sq;
      highlightLegal(sq);
    }
  }
});

// Outside-board click: clear selection (desktop only).
// On iOS a tap fires touchstart → touchend → click.  The click would race
// against _skipClear and clear selectedSq even when _skipClear is set,
// so we skip the handler entirely on touch devices.
if (!isTouchDevice) {
  document.addEventListener('click', () => {
    if (_skipClear) { _skipClear = false; return; }
    if (selectedSq) {
      clearHighlights();
      selectedSq = null;
    }
  });
}

// =========================================================
// TAP-TO-MOVE — single touchend on #board (iOS Safari)
//
// One listener on the board element only, handling everything
// in touchend.  No touchstart listener, no document-level
// listener, no _skipClear interaction.
//
// touchSelectedSq is completely separate from selectedSq (desktop)
// so the two systems cannot interfere with each other.
// =========================================================

let touchSelectedSq = null;

if (isTouchDevice) {
document.getElementById('board').addEventListener('touchend', function(e) {
  e.preventDefault();

  const touch = e.changedTouches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);

  // Walk up from the hit element until we find a chessboard.js square class.
  let sq = null;
  let node = el;
  while (node && node.id !== 'board') {
    if (typeof node.className === 'string') {
      const m = node.className.match(/square-([a-h][1-8])/);
      if (m) { sq = m[1]; break; }
    }
    node = node.parentElement;
  }

  if (!sq) return;
  if (!gameActive || isReviewing()) return;

  if (!touchSelectedSq) {
    // First tap — select if own piece.
    const piece = game.get(sq);
    const isMyPiece = piece && piece.color === humanColor && game.turn() === humanColor;
    if (isMyPiece) {
      touchSelectedSq = sq;
      selectedSq = sq;
      highlightLegal(sq);
    }
  } else if (sq === touchSelectedSq) {
    // Tapped same square — deselect.
    touchSelectedSq = null;
    selectedSq = null;
    clearHighlights();
  } else {
    // Second tap — attempt move.
    const from = touchSelectedSq;
    touchSelectedSq = null;
    selectedSq = null;
    clearHighlights();

    const move = game.move({ from, to: sq, promotion: 'q' });

    if (move) {
      board.position(game.fen());
      pushMove(move.san);
      if (game.game_over()) { handleGameOver(); return; }
      setStatus('Stockfish is thinking…');
      setTimeout(doEngineMove, 300);
    } else {
      // Illegal — check if tapped another own piece to switch selection.
      const piece = game.get(sq);
      const isMyPiece = piece && piece.color === humanColor && game.turn() === humanColor;
      if (isMyPiece) {
        touchSelectedSq = sq;
        selectedSq = sq;
        highlightLegal(sq);
      }
    }
  }
}, { passive: false });
} // end isTouchDevice

// =========================================================
// HIGHLIGHT HELPERS
// =========================================================

function highlightLegal(source) {
  clearHighlights();
  const moves = game.moves({ square: source, verbose: true });
  const sel = squareEl(source);
  if (sel) sel.classList.add('highlight-selected');
  moves.forEach(m => {
    const el = squareEl(m.to);
    if (el) el.classList.add('highlight-legal');
  });
}

function clearHighlights() {
  document.querySelectorAll('.highlight-legal, .highlight-selected').forEach(el => {
    el.classList.remove('highlight-legal', 'highlight-selected');
  });
}

function squareEl(sq) {
  return document.querySelector(`[data-square="${sq}"]`);
}

// =========================================================
// ENGINE MOVE
// =========================================================

async function doEngineMove() {
  if (!gameActive) return;

  const uciMove = await sfEngine.getBestMove(game.fen(), difficulty);

  // Guard: ignore stale responses after game ended or new game started
  if (!gameActive) return;

  if (!uciMove) {
    // No move returned (game over, or engine cancelled)
    if (game.game_over()) handleGameOver();
    return;
  }

  const from = uciMove.slice(0, 2);
  const to   = uciMove.slice(2, 4);
  const prom = uciMove.length === 5 ? uciMove[4] : 'q';

  const moveResult = game.move({ from, to, promotion: prom });
  if (moveResult) pushMove(moveResult.san);

  board.position(game.fen());

  if (game.game_over()) {
    handleGameOver();
    return;
  }

  if (!isReviewing()) setStatus('Your turn');
}

// =========================================================
// GAME OVER
// =========================================================

function handleGameOver(resultMsg) {
  gameActive = false;
  gameResult = resultMsg || deriveResult();

  resultBanner.textContent  = gameResult;
  resultBanner.classList.remove('hidden', 'win', 'loss', 'draw');

  const lower = gameResult.toLowerCase();
  if (lower.includes('draw') || lower.includes('stalemate') ||
      lower.includes('repetition') || lower.includes('fifty') || lower.includes('material')) {
    resultBanner.classList.add('draw');
  } else if (
    (humanColor === 'w' && lower.includes('white wins')) ||
    (humanColor === 'b' && lower.includes('black wins'))
  ) {
    resultBanner.classList.add('win');
  } else {
    resultBanner.classList.add('loss');
  }

  updateResignButton();
  setStatus('Game over');
}

function handleResign() {
  const result = humanColor === 'w'
    ? 'Black wins — White resigned'
    : 'White wins — Black resigned';
  handleGameOver(result);
}

function deriveResult() {
  if (game.in_checkmate())
    return game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
  if (game.in_stalemate()) return 'Draw by stalemate';
  if (game.in_draw())      return 'Draw';
  return 'Game over';
}

// =========================================================
// UTILITY
// =========================================================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* =========================================================
   Opening Roulette — pgn.js
   PGN generation and export.
   Reads shared globals: currentEco, currentOpeningName,
   humanColor, difficulty, sanHistory, gameResult.
   ========================================================= */

'use strict';

function generatePgn() {
  // Map result string → PGN result token
  let pgnResult = '*';
  if (gameResult) {
    const lower = gameResult.toLowerCase();
    if      (lower.includes('white wins'))  pgnResult = '1-0';
    else if (lower.includes('black wins'))  pgnResult = '0-1';
    else if (lower.includes('draw') || lower.includes('stalemate') ||
             lower.includes('repetition') || lower.includes('fifty'))
                                            pgnResult = '1/2-1/2';
  }

  const today   = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('.');

  const whitePlayer = humanColor === 'w' ? 'Human' : `Stockfish (ELO ${difficulty})`;
  const blackPlayer = humanColor === 'b' ? 'Human' : `Stockfish (ELO ${difficulty})`;

  let pgn = '';
  pgn += `[Event "Opening Roulette"]\n`;
  pgn += `[Date "${dateStr}"]\n`;
  pgn += `[White "${whitePlayer}"]\n`;
  pgn += `[Black "${blackPlayer}"]\n`;
  pgn += `[Result "${pgnResult}"]\n`;
  pgn += `[ECO "${currentEco}"]\n`;
  pgn += `[Opening "${currentOpeningName}"]\n`;
  pgn += '\n';

  let moveText = '';
  for (let i = 0; i < sanHistory.length; i++) {
    if (i % 2 === 0) moveText += `${Math.floor(i / 2) + 1}. `;
    moveText += sanHistory[i] + ' ';
  }
  moveText = moveText.trimEnd();
  if (pgnResult !== '*') moveText += ' ' + pgnResult;

  pgn += moveText + '\n';
  return pgn;
}

// ── Clipboard helpers ────────────────────────────────────────

function fallbackCopy(text) {
  // iOS Safari fallback: create an off-screen textarea, select it, execCommand.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top  = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, 99999); // required for iOS
  try {
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    document.body.removeChild(ta);
    return false;
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

// ── Public API ───────────────────────────────────────────────

function exportPgn() {
  const pgn      = generatePgn();
  const filename = (currentOpeningName || 'game').replace(/[^a-zA-Z0-9]+/g, '_') + '.pgn';
  const blob     = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  // Best-effort clipboard copy alongside download
  copyToClipboard(pgn).catch(() => {});
}

function copyPgn() {
  const pgn = generatePgn();
  const btn = document.getElementById('btn-copy-pgn');

  copyToClipboard(pgn).then(ok => {
    const origHTML = btn.innerHTML;
    if (ok) {
      btn.innerHTML = '<span class="bar-icon">✓</span><span class="bar-label">Copied!</span>';
    } else {
      btn.innerHTML = '<span class="bar-icon">✗</span><span class="bar-label">Use ↓ PGN</span>';
    }
    setTimeout(() => { btn.innerHTML = origHTML; }, 2000);
  });
}

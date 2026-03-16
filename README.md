# Opening Roulette

Practice chess openings against Stockfish.

**Live app:** https://stchkotoua.github.io/chess-opening-roulette-mobile/

## 📱 Install on iPhone (Offline)

1. Open **Safari** on your iPhone
2. Go to: https://stchkotoua.github.io/chess-opening-roulette-mobile/
3. Tap the **Share** button (□↑) at the bottom of Safari
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **Add**
6. Open the app from your home screen — it works fully offline, no WiFi or data needed after the first load

> **Note:** Must use Safari (not Chrome) to install as a PWA on iPhone.
> Once installed, clearing Safari history will NOT affect the app.

## Features

- **3,641 openings** from ECO codes A–E, loaded from local TSV files
- **4-level cascading filter**: family → named opening → variation → subvariation
  - Family: King's Pawn (1.e4), Queen's Pawn (1.d4), English / Réti (1.c4, 1.Nf3), Flank & Irregular
  - Named openings grouped by category with `<optgroup>` for e4 and d4
  - Variations and subvariations derived from actual database content (≥3 entries each)
- **Theory depth filter**: Any / Shallow (≤5 moves) / Medium (6–9) / Deep (10+)
- **Animated theory replay** — opening moves play out before the game begins
- **Play as White, Black, or Random**
- **Adjustable Stockfish ELO** from 1320 to 3000
- **Tap-to-move** on iOS/Android, **drag-to-move** on desktop
- **Move history** with click-to-navigate (move list sheet + horizontal strip)
- **PGN export** — download as file or copy to clipboard
- **Resign button** with confirmation dialog
- **Dark / light theme** toggle (persisted in localStorage)
- **Rank and file labels** outside the board, orientation-aware (flips for Black)
- **Installable PWA** — works fully offline after first load

## Running locally

No build step required. Serve from any static file server:

```bash
npx serve .
# then open http://localhost:3000
```

Stockfish WASM requires the page to be served over HTTP(S) — opening `index.html`
directly as a `file://` URL will not work.

## License

MIT

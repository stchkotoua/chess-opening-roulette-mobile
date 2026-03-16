# Opening Roulette

Practice chess openings against Stockfish — fully offline.

**Live app:** https://stchkotoua.github.io/chess-opening-roulette-mobile/

## Features

- Randomly picks a chess opening from ECO codes A–E
- Filter by opening family (1.e4 / 1.d4 / flank) or named opening
- Filter by theory depth (shallow / medium / deep)
- Animated replay of opening theory moves before the game begins
- Play as White, Black, or Random
- Adjustable Stockfish ELO strength (1320–3000)
- Tap-to-move on iOS/Android, drag-to-move on desktop
- Full move history with click-to-navigate
- PGN export and clipboard copy
- Dark / light theme toggle
- **Installable PWA — works fully offline after first load**

## Install as a PWA on iPhone

1. Open https://stchkotoua.github.io/chess-opening-roulette-mobile/ in Safari
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** — the app icon appears on your home screen
5. Open it from the home screen for a full-screen, offline experience

The app caches all assets (including the Stockfish engine) on first load.
After that, it works with no internet connection.

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

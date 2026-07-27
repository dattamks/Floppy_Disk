# Floppy Disk — React + Vite

Web frontend for the Floppy Disk cloud-storage app (Drive-style: files, folders,
preview, share, self-hosted video playback).

## Run
```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # production build -> dist/
npm run preview    # preview the build
npm run test:unit  # Vitest unit tests
npm run test:e2e   # Playwright E2E (boots the backend on SQLite + Vite)
```

## Structure
- `index.html` — entry, loads Google Fonts
- `src/main.jsx` — React root
- `src/App.jsx` — stateful container: state, handlers, API wiring, `renderVals()`
- `src/view/AppView.jsx` — composition root (renders the computed view-model `V`)
- `src/components/` — presentational components + modals
- `src/lib/` — `ui.js` (helpers), `markdown.js` (renderer), `theme.js` (tokens)
- `src/api.js` — REST client; same-origin via the Vite dev proxy (`/api` → `:8000`)
- `e2e/` — Playwright specs · `src/**/*.test.js` — Vitest unit tests

State persists to `localStorage` (`floppydisk-state`). Seed/demo media uses picsum.photos.

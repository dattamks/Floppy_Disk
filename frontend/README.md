# Floppy Disk — React + Vite

Cloud storage / sharing / streaming web app.

## Run
```bash
npm install
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build -> dist/
npm run preview  # preview the build
```

## Structure
- `index.html` — entry, loads Google Fonts
- `src/main.jsx` — React root
- `src/App.jsx` — the whole app (single component: state, handlers, render)
- `src/index.css` — global resets, scrollbars, keyframes, focus styles

State persists to `localStorage` (`floppydisk-state`). Placeholder media uses picsum.photos.

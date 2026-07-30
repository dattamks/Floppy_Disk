// Records the Graphify/folder-scope playthrough as proof (video + screenshots).
// Usage: npx playwright test --config=playwright.playthrough.config.js
// Reuses the base config's backend (SQLite) + Vite dev server.
import base from './playwright.config.js';

export default {
  ...base,
  testMatch: /graphify-playthrough\.spec\.js/,
  outputDir: './test-results/playthrough',
  use: {
    ...base.use,
    video: 'on',
    screenshot: 'on',
    viewport: { width: 1280, height: 800 },
  },
};

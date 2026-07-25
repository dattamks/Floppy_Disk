// Records a screen video of the user-journey flow (artifact for CI / demos).
// Usage: npm run test:journey:video  -> videos under test-results/journey-video/.
// Reuses the base config's webServers; only the journey spec runs, with video on.
import base from './playwright.config.js';

export default {
  ...base,
  testMatch: /user-journey\.spec\.js/,
  outputDir: './test-results/journey-video',
  use: {
    ...base.use,
    video: 'on',
    viewport: { width: 1280, height: 800 },
  },
};

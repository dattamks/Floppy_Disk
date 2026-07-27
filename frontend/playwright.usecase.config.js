// Records a screen video of the full Drive use-case flow (demo artifact).
// Usage: npx playwright test --config=playwright.usecase.config.js
// Video is written under test-results/usecase-video/.
import base from './playwright.config.js';

export default {
  ...base,
  testMatch: /drive-usecase\.spec\.js/,
  outputDir: './test-results/usecase-video',
  use: {
    ...base.use,
    video: 'on',
    viewport: { width: 1280, height: 800 },
  },
};

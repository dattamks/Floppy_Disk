import { defineConfig } from 'vitest/config';

// Unit tests live next to the code as *.test.js under src/. Playwright's E2E
// specs (e2e/*.spec.js) are deliberately excluded so the two runners don't
// pick up each other's files.
export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
});

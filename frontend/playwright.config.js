import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../backend');

// Environment-portable knobs (portable defaults; GitHub Actions overrides some
// via env — see .github/workflows/ci.yml):
//  - PW_MANAGED_BROWSER=1  -> use Playwright's own installed Chromium (default)
//  - PW_CHROMIUM_PATH      -> explicit Chromium binary
//  - BACKEND_PYTHON        -> python that runs the E2E backend (needs the backend
//                             deps installed; default `python3`)
//  - E2E_DB                -> SQLite file for the E2E backend (default: temp dir)
// Managed Chromium is the default so a fresh clone works after
// `npx playwright install chromium`.
const USE_MANAGED = process.env.PW_MANAGED_BROWSER !== '0';
const CHROMIUM = process.env.PW_CHROMIUM_PATH || '';
const PY = process.env.BACKEND_PYTHON || 'python3';
const E2E_DB = process.env.E2E_DB || path.join(os.tmpdir(), 'floppy-e2e.sqlite3');

export default defineConfig({
  testDir: './e2e',
  // Deactivated features (Drive-focus pivot) aren't run — see docs/deactivated-features.md
  testIgnore: '**/deactivated/**',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: USE_MANAGED
      ? { args: ['--no-sandbox'] }
      : { executablePath: CHROMIUM, args: ['--no-sandbox'] },
  },
  webServer: [
    {
      // Backend on SQLite so E2E needs no Postgres.
      command:
        `${PY} manage.py migrate --noinput && ` + `${PY} manage.py runserver 8000 --noreload`,
      cwd: backendDir,
      url: 'http://localhost:8000/health/',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings.local',
        DATABASE_URL: `sqlite:///${E2E_DB}`,
        DJANGO_SECRET_KEY: 'e2e-secret-key',
        DJANGO_DEBUG: 'True',
      },
    },
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: 'http://localhost:5173',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../backend');

// Use the pre-installed Chromium (no download); sandbox off for CI containers.
const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const E2E_DB = '/tmp/claude-0/-home-user-Floppy-Disk/5c03de2b-195c-53d0-b890-a3793c5ab2e1/scratchpad/e2e.sqlite3';

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
    launchOptions: { executablePath: CHROMIUM, args: ['--no-sandbox'] },
  },
  webServer: [
    {
      // Backend on SQLite so E2E needs no Postgres.
      command:
        '.venv/bin/python manage.py migrate --noinput && ' +
        '.venv/bin/python manage.py runserver 8000 --noreload',
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

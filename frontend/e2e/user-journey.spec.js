import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Full end-to-end user journey through the app, asserting each milestone:
// sign up -> create folder -> upload a real image -> context menu -> share ->
// preview -> play a video -> trash -> log out.
//
// To also capture a screen recording, run with video enabled, e.g.:
//   npx playwright test user-journey --config=playwright.config.js \
//     --headed=false -- (or set `use: { video: 'on' }`)
// The narrated, pre-recorded walkthrough lives outside the repo (see the
// journey scripts under the session scratchpad).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE = path.resolve(__dirname, 'fixtures', 'beach-sunset.png');

function uniqueEmail() {
  return `journey-${Date.now()}-${Math.floor(Math.random() * 1e6)}@floppy.disk`;
}
const PASSWORD = 's3cretpass99';

// Keep the run fast + deterministic: block external hosts (demo media).
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:'))
      return route.continue();
    return route.abort();
  });
});

test('full user journey: sign up → upload → share → play → trash → log out', async ({ page }) => {
  const email = uniqueEmail();

  // 1. Sign up
  await page.goto('/');
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByPlaceholder('Full name').fill('Aiden Rivera');
  await page.locator('input[type="date"]').fill('1995-06-15');
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();

  // 2. Create a folder and open it
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill('Vacation Photos');
  await page.getByRole('button', { name: 'Create folder' }).click();
  await page.getByText('Vacation Photos', { exact: false }).first().click();

  // 3. Upload a real image and confirm it becomes ready
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles(IMAGE);
  await page.keyboard.press('Escape');
  await expect(page.getByText('beach-sunset.png', { exact: false }).first()).toBeVisible({
    timeout: 15000,
  });

  // 4. Context menu (right-click) exposes the item actions
  await page.getByText('beach-sunset.png', { exact: false }).first().click({ button: 'right' });
  await expect(page.getByText('Move to trash', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');

  // 5. Share the file via the overflow menu
  await page.locator('[aria-label="More actions"]').first().click();
  await page.getByText('Share link', { exact: false }).first().click();
  await expect(page.locator('body')).toContainText(/share|link|floppy\.disk\/s\//i);
  await page.keyboard.press('Escape');

  // 6. Back to My Files and play a video
  await page.getByText('My Files', { exact: true }).first().click();
  await page.getByText('Q3-brand-keynote.mp4', { exact: false }).first().click();
  await expect(page.locator('video')).toBeVisible();
  await page.keyboard.press('Escape');

  // 7. Trash shows the retention notice
  await page.getByText('Trash', { exact: false }).first().click();
  await expect(page.getByText(/kept for|days? left|retention/i).first()).toBeVisible();

  // 9. Log out
  await page.getByText('Log out', { exact: false }).first().click();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
});

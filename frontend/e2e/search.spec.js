import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('search surfaces a file via the backend and the UI', async ({ page }) => {
  await registerNewUser(page);

  const stem = `searchme${Date.now()}`;
  const name = `${stem}.txt`;
  await page.getByRole('button', { name: 'Upload' }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/complete')),
    page.locator('input[type="file"]').setInputFiles({
      name, mimeType: 'text/plain', buffer: Buffer.from('searchable bytes'),
    }),
  ]);
  await expect(page.getByText(name)).toBeVisible();

  // Backend search endpoint returns it (through the app session).
  const results = await page.evaluate(async (q) => {
    const r = await fetch('/api/v1/storage/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' });
    return (await r.json()).results;
  }, stem);
  expect(results.some((x) => x.name === name)).toBe(true);

  // UI search box filters to it.
  await page.getByPlaceholder('Search files and folders').first().fill(stem);
  await expect(page.getByText(name).first()).toBeVisible();
});

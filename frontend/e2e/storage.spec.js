import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('create a folder and it persists to the backend', async ({ page }) => {
  await registerNewUser(page);

  const name = `E2E Folder ${Date.now()}`;
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill(name);
  await page.getByRole('button', { name: 'Create folder' }).click();

  await expect(page.getByText(name)).toBeVisible();

  // Wipe the local cache so the folder can ONLY reappear if it was persisted to
  // (and re-fetched from) the backend, not localStorage.
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByText(name)).toBeVisible();
});

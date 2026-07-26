import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('create a channel and it persists to the backend', async ({ page }) => {
  await registerNewUser(page);

  const ts = Date.now();
  const name = `E2EChan${ts}`;
  const handle = `e2echan${ts}`;

  // Go to Channels and open the new-channel modal.
  await page.locator('button:visible', { hasText: 'Channels' }).first().click();
  await page.getByRole('button', { name: 'New', exact: true }).click();

  await page.getByPlaceholder('e.g. Product Design').fill(name);
  await page.getByPlaceholder('@handle (optional)').fill(handle);
  await page.getByRole('button', { name: 'Create channel' }).click();

  await expect(page.getByText(name).first()).toBeVisible();

  // Clear local cache: the channel can only reappear if it came from the backend.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('button:visible', { hasText: 'Channels' }).first().click();
  await expect(page.getByText(name).first()).toBeVisible();
});

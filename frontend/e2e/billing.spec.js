import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('upgrade storage subscribes on the backend and raises the quota', async ({ page }) => {
  await registerNewUser(page);

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/billing/subscribe')),
    page.getByRole('button', { name: 'Upgrade storage' }).click(),
  ]);
  expect(resp.status()).toBe(201);
  const body = await resp.json();
  expect(body.tier).toBe('paid_2tb');
  expect(body.quota_bytes).toBe(2 * 1024 ** 4); // 2 TB

  await expect(page.getByText(/Upgraded to 2TB/i)).toBeVisible();
});

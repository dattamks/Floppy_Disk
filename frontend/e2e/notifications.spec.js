import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('a channel-create event produces a real notification', async ({ page }) => {
  await registerNewUser(page);

  const ts = Date.now();
  // Create a channel through the UI (fires a channel_created notification).
  await page.locator('button:visible', { hasText: 'Channels' }).first().click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByPlaceholder('e.g. Product Design').fill(`Notif${ts}`);
  await page.getByPlaceholder('@handle (optional)').fill(`notif${ts}`);
  await page.getByRole('button', { name: 'Create channel' }).click();
  await expect(page.getByText(`Notif${ts}`).first()).toBeVisible();

  // Read notifications through the app's own session (same-origin, cookie auth).
  const data = await page.evaluate(async () => {
    const r = await fetch('/api/v1/notifications/', { credentials: 'same-origin' });
    return r.json();
  });
  expect(data.unread_count).toBeGreaterThanOrEqual(1);
  expect(data.results.some((n) => n.type === 'channel_created')).toBe(true);
});

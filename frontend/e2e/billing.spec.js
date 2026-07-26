import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('billing deferred: new users are paid by default and no upgrade CTA shows', async ({
  page,
}) => {
  await registerNewUser(page);

  // Paid-by-default while Razorpay is disabled (RAZORPAY_ENABLED=false).
  const me = await page.evaluate(async () =>
    (await fetch('/api/v1/auth/me', { credentials: 'same-origin' })).json()
  );
  expect(me.tier).toBe('paid_2tb');
  expect(me.quota_bytes).toBe(2 * 1024 ** 4); // 2 TB
  expect(me.billing_enabled).toBe(false);

  // No upgrade CTA when billing is off.
  await expect(page.getByRole('button', { name: 'Upgrade storage' })).toHaveCount(0);
});

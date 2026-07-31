import { test, expect } from '@playwright/test';
import { blockExternal } from './helpers.js';

// The /reset-password?token=… page (reached from a reset email link).
test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('reset-password link shows the set-password form and validates input', async ({ page }) => {
  await page.goto('/reset-password?token=fake-uid:fake-token');
  await expect(page.getByText('Choose a new password')).toBeVisible({ timeout: 10000 });

  // Mismatched passwords are rejected client-side.
  await page.getByPlaceholder('New password', { exact: true }).fill('LongEnough123');
  await page.getByPlaceholder('Confirm new password', { exact: true }).fill('Different123');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText(/do not match/i)).toBeVisible();

  // Too-short passwords are rejected client-side.
  await page.getByPlaceholder('New password', { exact: true }).fill('short');
  await page.getByPlaceholder('Confirm new password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText(/at least 8/i)).toBeVisible();

  // A well-formed but invalid/expired token is rejected by the server.
  await page.getByPlaceholder('New password', { exact: true }).fill('ValidPass123!');
  await page.getByPlaceholder('Confirm new password', { exact: true }).fill('ValidPass123!');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 10000 });
});

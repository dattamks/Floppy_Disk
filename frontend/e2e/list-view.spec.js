import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('sort and grid/list view toggles work', async ({ page }) => {
  await registerNewUser(page);
  // Seed data is present, so the listing toolbar shows.
  const anItem = page.getByText('Product Shoots', { exact: true }).first();
  await expect(anItem).toBeVisible();

  // Switch to list view — the same items remain listed.
  await page.getByRole('button', { name: 'List view' }).click();
  await expect(anItem).toBeVisible();

  // Sort by size, then back to grid — nothing breaks, items still shown.
  await page.getByRole('button', { name: 'Size' }).click();
  await page.getByRole('button', { name: 'Grid view' }).click();
  await expect(anItem).toBeVisible();
});

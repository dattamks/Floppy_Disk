import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('sort and grid/list view toggles work', async ({ page }) => {
  await registerNewUser(page);

  // Create our own item so the listing toolbar has something to show (accounts
  // now start empty - no demo seed data).
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill('Reports');
  await page.getByRole('button', { name: 'Create folder' }).click();
  const anItem = page.getByText('Reports', { exact: true }).first();
  await expect(anItem).toBeVisible();

  // Switch to list view - the same item remains listed.
  await page.getByRole('button', { name: 'List view' }).click();
  await expect(anItem).toBeVisible();

  // Sort by size, then back to grid - nothing breaks, item still shown.
  await page.getByRole('button', { name: 'Size' }).click();
  await page.getByRole('button', { name: 'Grid view' }).click();
  await expect(anItem).toBeVisible();
});

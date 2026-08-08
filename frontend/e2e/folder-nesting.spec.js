import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Regression: nested folder contents must load when you navigate into a folder.
// Previously the SPA only fetched root-level folders/files, so anything inside a
// subfolder looked empty after a reload / fresh login.
test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('subfolders and their files show after navigating in (and after reload)', async ({ page }) => {
  await registerNewUser(page);

  // The file grid (scoped, so folder names in the new left-hand folder tree
  // don't collide with the same names shown as grid cards).
  const grid = page.getByTestId('files-grid');

  // Create a top-level "Projects" folder and open it.
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill('Projects');
  await page.getByRole('button', { name: 'Create folder' }).click();
  await grid.getByText('Projects', { exact: true }).first().dblclick();
  await expect(page.getByText(/Projects/).first()).toBeVisible();

  // Create a subfolder "Aurora" inside Projects.
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill('Aurora');
  await page.getByRole('button', { name: 'Create folder' }).click();
  await expect(grid.getByText('Aurora', { exact: true }).first()).toBeVisible();

  // Upload a file into Aurora.
  await grid.getByText('Aurora', { exact: true }).first().dblclick();
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'nested.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('nested content'),
  });
  await expect(grid.getByText('nested.txt').first()).toBeVisible({ timeout: 15000 });

  // Reload (fresh session) → go back into Projects → Aurora → the file is there.
  await page.reload();
  await page.getByRole('button', { name: 'Upload' }).waitFor();
  await grid.getByText('Projects', { exact: true }).first().dblclick();
  await expect(grid.getByText('Aurora', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await grid.getByText('Aurora', { exact: true }).first().dblclick();
  await expect(grid.getByText('nested.txt').first()).toBeVisible({ timeout: 15000 });
});

import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('drag a file onto a folder moves it there', async ({ page }) => {
  await registerNewUser(page);

  // A destination folder and a file at the root.
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill('Dropzone');
  await page.getByRole('button', { name: 'Create folder' }).click();

  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'dragme.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('drag me'),
  });
  await page.keyboard.press('Escape');
  const grid = page.getByTestId('files-grid');
  await expect(grid.getByText('dragme.txt', { exact: true }).first()).toBeVisible();

  // Drag the file card onto the folder card (native HTML5 DnD). Scope to the
  // grid so the folder tree in the left secondary sidebar isn't the drop target.
  await grid
    .getByText('dragme.txt', { exact: true })
    .first()
    .dragTo(grid.getByText('Dropzone', { exact: true }).first());

  // The file left the root...
  await expect(grid.getByText('dragme.txt', { exact: true })).toHaveCount(0);
  // ...and is inside the folder.
  await grid.getByText('Dropzone', { exact: true }).first().click();
  await expect(grid.getByText('dragme.txt', { exact: true }).first()).toBeVisible();
});

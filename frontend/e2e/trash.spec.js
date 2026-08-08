import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

async function uploadFile(page, name) {
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('trash test bytes'),
  });
  await expect(page.getByText(name)).toBeVisible();
}

test('soft-delete a file to trash, and it stays deleted on the backend', async ({ page }) => {
  await registerNewUser(page);
  await uploadFile(page, 'trashme.txt');

  // Open the file, then Delete (soft-delete -> trash).
  await page.getByText('trashme.txt').click();
  await page.getByRole('button', { name: 'Delete' }).click();

  // Gone from My Files...
  await expect(page.getByText('trashme.txt')).toHaveCount(0);

  // ...and the backend really soft-deleted it: after a cache clear + reload it
  // does NOT come back into My Files (listFiles excludes trashed).
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
  await expect(page.getByText('trashme.txt')).toHaveCount(0);

  // But it IS in Trash (loaded from the backend trash endpoint).
  await page.getByTestId('nav-trash').click();
  await expect(page.getByText('trashme.txt')).toBeVisible();
});

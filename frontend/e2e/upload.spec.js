import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('upload a file end-to-end and it persists to the backend', async ({ page }) => {
  await registerNewUser(page);

  // Open the upload modal, then feed bytes to the hidden file input.
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello floppy disk — real upload'),
  });

  // The file card appears once initiate -> PUT -> complete finishes.
  await expect(page.getByText('hello.txt')).toBeVisible();

  // Wipe local cache: the file can only reappear if it was really stored + listed.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('hello.txt')).toBeVisible();
});

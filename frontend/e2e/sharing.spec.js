import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('sharing a file creates a real backend link', async ({ page }) => {
  await registerNewUser(page);

  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'sharable.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('share me'),
  });
  await expect(page.getByText('sharable.txt')).toBeVisible();

  // Open the file, then Share.
  await page.getByText('sharable.txt').click();
  await page.getByRole('button', { name: 'Share', exact: true }).first().click();

  // The modal shows a real token link minted by the backend.
  await expect(page.getByLabel('Share link')).toHaveValue(/\/s\/.+/);
});

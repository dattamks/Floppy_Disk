import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('image preview has next/prev gallery navigation', async ({ page }) => {
  await registerNewUser(page);

  for (const name of ['a.png', 'b.png']) {
    await page.getByRole('button', { name: 'Upload' }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name, mimeType: 'image/png', buffer: Buffer.from('fake-png-' + name) });
    await page.keyboard.press('Escape');
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  // Open the first image; the dialog shows it and a Next arrow.
  await page.getByText('a.png', { exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('a.png')).toBeVisible();
  await dialog.getByLabel('Next image').click();

  // Now the second image is shown.
  await expect(dialog.getByText('b.png')).toBeVisible();
});

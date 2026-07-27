import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('select multiple files and bulk-trash them', async ({ page }) => {
  await registerNewUser(page);

  // Upload two files at the root.
  for (const name of ['one.txt', 'two.txt']) {
    await page.getByRole('button', { name: 'Upload' }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });
    await page.keyboard.press('Escape');
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  // Select both via their card checkboxes (find the checkbox in each card).
  const checkbox = (name) =>
    page
      .getByText(name, { exact: true })
      .first()
      .locator('xpath=ancestor::div[.//*[@aria-label="Select"]][1]')
      .getByLabel('Select');
  await checkbox('one.txt').click();
  await checkbox('two.txt').click();

  // The selection bar reports the count; bulk-trash them.
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Trash', exact: true }).click();

  // Both leave the active listing.
  await expect(page.getByText('one.txt', { exact: true })).toHaveCount(0);
  await expect(page.getByText('two.txt', { exact: true })).toHaveCount(0);
});

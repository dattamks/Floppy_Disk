import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('edit a text file in place and save', async ({ page }) => {
  await registerNewUser(page);

  // Unique tokens so content-addressed dedup never reuses a prior run's blob.
  const u = Date.now();
  const before = `item-a-${u}`;
  const after = `item-b-${u}`;

  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'todo.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(`# Todo\n\n- ${before}`),
  });
  await page.keyboard.press('Escape');
  await expect(page.getByText('todo.md', { exact: true }).first()).toBeVisible();

  // Open; a .md note opens full-page straight into the clean writing surface,
  // and the content is shown as the rendered document.
  await page.getByText('todo.md', { exact: true }).first().click();
  const dialog = page.getByTestId('file-page'); // documents now open full-page in the content area
  await expect(dialog.getByText(before, { exact: true })).toBeVisible({ timeout: 15000 });

  // Toggle to editable Source (raw Markdown) to make a precise edit.
  await dialog.getByTestId('file-page-source').click();
  await expect(dialog.locator('textarea')).toHaveValue(new RegExp(before));
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/content') && r.request().method() === 'PUT'),
    (async () => {
      await dialog.locator('textarea').fill(`# Todo\n\n- ${before}\n- ${after}`);
      await dialog.getByRole('button', { name: 'Save' }).click();
    })(),
  ]);
  expect(resp.status()).toBe(200);

  // Re-open to confirm the edit persisted.
  await page.getByTestId('file-page-back').click();
  await page.getByText('todo.md', { exact: true }).first().click();
  await expect(dialog.getByText(after, { exact: true })).toBeVisible({ timeout: 15000 });
});

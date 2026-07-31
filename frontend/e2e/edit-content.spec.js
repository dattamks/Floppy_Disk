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

  // Open; the rendered markdown confirms the content loaded.
  await page.getByText('todo.md', { exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(before, { exact: true })).toBeVisible({ timeout: 15000 });

  // Edit and save. A .md file opens the note editor (Write | Markdown | Preview);
  // the raw textarea lives under the "Markdown" tab.
  await dialog.getByRole('button', { name: 'Edit' }).click();
  await dialog.getByRole('button', { name: 'Markdown' }).click();
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
  await page.keyboard.press('Escape');
  await page.getByText('todo.md', { exact: true }).first().click();
  await expect(dialog.getByText(after, { exact: true })).toBeVisible({ timeout: 15000 });
});

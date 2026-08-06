import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Attachment field: link a table row to a stored file.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('attach a stored file to a table row', async ({ page }) => {
  await registerNewUser(page);

  // Upload a file so there is something to attach.
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 hello'),
  });
  await expect(page.getByText('report.pdf')).toBeVisible();
  await page.keyboard.press('Escape');

  // New table + an attachment column (index 3 after Name/Notes/Status).
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();
  await grid.getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill('Docs');
  await dlg.getByLabel('Column type').selectOption('attachment');
  await dlg.getByRole('button', { name: 'Add column' }).click();

  // Open the picker on row 0's attachment cell and choose the file.
  const cell = grid.locator('[data-r="0"][data-c="3"]');
  await cell.dblclick();
  await page.getByRole('button', { name: 'report.pdf' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(cell).toContainText('report.pdf');

  // Persists across a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  await expect(page.getByTestId('table-grid').locator('[data-r="0"][data-c="3"]')).toContainText('report.pdf');
});

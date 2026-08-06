import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Relation field: link a row in one table to rows in another.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function nameFirstRow(page, grid, value) {
  const cell = grid.locator('[data-r="0"][data-c="0"]');
  await cell.dblclick();
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}

test('link a Projects row to a People row via a relation column', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Tables' }).click();

  // Table 1: People, with a named row.
  await page.getByTestId('new-table').click();
  let grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();
  const title = page.getByLabel('Table name');
  await title.click(); await title.fill('People'); await page.keyboard.press('Enter');
  await nameFirstRow(page, grid, 'Alice');
  await page.getByRole('button', { name: 'Back to tables' }).click();

  // Table 2: Projects, with a relation column pointing at People.
  await page.getByTestId('new-table').click();
  grid = page.getByTestId('table-grid');
  const t2 = page.getByLabel('Table name');
  await t2.click(); await t2.fill('Projects'); await page.keyboard.press('Enter');

  await grid.getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill('Owner');
  await dlg.getByLabel('Column type').selectOption('relation');
  await dlg.getByLabel('Linked table').selectOption({ label: 'People' });
  await dlg.getByRole('button', { name: 'Add column' }).click();

  // Open the relation cell's picker and link Alice.
  const cell = grid.locator('[data-r="0"][data-c="3"]');
  await cell.dblclick();
  await page.getByRole('button', { name: 'Alice' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(cell).toContainText('Alice');

  // Persists across a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').filter({ hasText: 'Projects' }).click();
  await expect(page.getByTestId('table-grid').locator('[data-r="0"][data-c="3"]')).toContainText('Alice');
});

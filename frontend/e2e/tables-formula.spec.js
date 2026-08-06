import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Formula (computed) column: {Price} * {Qty}.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function addColumn(page, name, type, opts = {}) {
  await page.getByTestId('table-grid').getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill(name);
  await dlg.getByLabel('Column type').selectOption(type);
  if (opts.expr) await dlg.getByLabel('Formula expression').fill(opts.expr);
  await dlg.getByRole('button', { name: 'Add column' }).click();
}
async function typeCell(page, grid, c, text) {
  const cell = grid.locator(`[data-r="0"][data-c="${c}"]`);
  await cell.dblclick();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('a formula column computes from other cells', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();

  await addColumn(page, 'Price', 'number');
  await addColumn(page, 'Qty', 'number');
  await addColumn(page, 'Total', 'formula', { expr: '{Price} * {Qty}' });

  await typeCell(page, grid, 3, '10');
  await typeCell(page, grid, 4, '3');
  // Total (col 5) computes live.
  await expect(grid.locator('[data-r="0"][data-c="5"]')).toContainText('30');

  // Editing an input recomputes it.
  await typeCell(page, grid, 4, '5');
  await expect(grid.locator('[data-r="0"][data-c="5"]')).toContainText('50');
});

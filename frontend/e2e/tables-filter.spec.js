import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Filtering: narrow the visible rows by field conditions; filters persist to
// the view config across a reload.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function typeCell(page, grid, r, c, text) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.dblclick();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('filter rows by a number condition and persist it', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) {
    await page.getByTestId('setup-skip').click();
    await setup.waitFor({ state: 'hidden' }).catch(() => {});
  }

  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();

  // Name(0) Notes(1) Status(2) + Qty(3). Give the three starter rows names + qty.
  await page.getByTestId('table-grid').getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill('Qty');
  await dlg.getByLabel('Column type').selectOption('number');
  await dlg.getByRole('button', { name: 'Add column' }).click();

  await typeCell(page, grid, 0, 0, 'Alpha');
  await typeCell(page, grid, 0, 3, '10');
  await typeCell(page, grid, 1, 0, 'Beta');
  await typeCell(page, grid, 1, 3, '3');
  await typeCell(page, grid, 2, 0, 'Gamma');
  await typeCell(page, grid, 2, 3, '20');
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(3);

  // Add a filter: Qty >= 10  ->  Alpha (10) + Gamma (20), Beta (3) hidden.
  await page.getByTestId('filter-button').click();
  const panel = page.getByTestId('filter-panel');
  await panel.getByTestId('filter-add').click();
  await panel.getByLabel('Filter field').selectOption({ label: 'Qty' });
  await panel.getByLabel('Filter operator').selectOption('gte');
  await panel.getByLabel('Filter value').fill('10');

  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(2);
  await expect(page.getByTestId('row-count')).toContainText('2 of 3');
  await expect(grid.getByText('Beta')).toHaveCount(0);
  await expect(grid.getByText('Alpha')).toBeVisible();
  await expect(grid.getByText('Gamma')).toBeVisible();

  // The Filter button reflects the active count.
  await expect(page.getByTestId('filter-button')).toContainText('Filter · 1');

  // Persists across a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  const grid2 = page.getByTestId('table-grid');
  await expect(grid2.locator('[data-r][data-c="0"]')).toHaveCount(2);
  await expect(page.getByTestId('filter-button')).toContainText('Filter · 1');

  // Clearing filters restores all rows.
  await page.getByTestId('filter-button').click();
  await page.getByTestId('filter-clear').click();
  await expect(grid2.locator('[data-r][data-c="0"]')).toHaveCount(3);
});

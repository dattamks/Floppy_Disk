import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Multiple saved views over one source table (the Notion model): each view keeps
// its own filter/sort/group/kind, independently, and persists.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function typeCell(page, grid, r, c, text) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.dblclick();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('a table can have several views, each with its own config', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();

  // One starter Grid view.
  await expect(page.getByTestId('view-tab')).toHaveCount(1);

  // Name(0) Notes(1) Status(2) + Qty(3, number); fill three rows.
  await page.getByTestId('table-grid').getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill('Qty');
  await dlg.getByLabel('Column type').selectOption('number');
  await dlg.getByRole('button', { name: 'Add column' }).click();
  await typeCell(page, grid, 0, 0, 'Alpha'); await typeCell(page, grid, 0, 3, '10');
  await typeCell(page, grid, 1, 0, 'Beta'); await typeCell(page, grid, 1, 3, '3');
  await typeCell(page, grid, 2, 0, 'Gamma'); await typeCell(page, grid, 2, 3, '20');

  // Put a filter (Qty >= 10) on the FIRST (Grid) view -> 2 rows.
  await page.getByTestId('filter-button').click();
  const panel = page.getByTestId('filter-panel');
  await panel.getByTestId('filter-add').click();
  await panel.getByLabel('Filter field').selectOption({ label: 'Qty' });
  await panel.getByLabel('Filter operator').selectOption('gte');
  await panel.getByLabel('Filter value').fill('10');
  await page.getByLabel('Table name').click(); // dismiss panel
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(2);
  await expect(page.getByTestId('filter-button')).toContainText('Filter · 1');

  // Add a SECOND Grid view. It should be independent -> no filter, all 3 rows.
  await page.getByTestId('add-view').click();
  await page.getByTestId('add-view-grid').click();
  await expect(page.getByTestId('view-tab')).toHaveCount(2);
  await expect(page.getByTestId('table-grid').locator('[data-r][data-c="0"]')).toHaveCount(3);
  await expect(page.getByTestId('filter-button')).toHaveText('Filter'); // no active filter here

  // Switch back to the first view -> its filter is intact (2 rows).
  await page.getByTestId('view-tabs').locator('[data-view-kind="grid"]').first().click();
  await expect(page.getByTestId('table-grid').locator('[data-r][data-c="0"]')).toHaveCount(2);
  await expect(page.getByTestId('filter-button')).toContainText('Filter · 1');

  // Views + their independent config persist across a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  await expect(page.getByTestId('view-tab')).toHaveCount(2);
  // First view still filtered.
  await expect(page.getByTestId('table-grid').locator('[data-r][data-c="0"]')).toHaveCount(2);
  // Second view still unfiltered.
  await page.getByTestId('view-tabs').locator('[data-view-kind="grid"]').nth(1).click();
  await expect(page.getByTestId('table-grid').locator('[data-r][data-c="0"]')).toHaveCount(3);

  // Delete the (active) second view; one tab remains.
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('view-delete').click();
  await expect(page.getByTestId('view-tab')).toHaveCount(1);
  // The last remaining view has no delete affordance.
  await expect(page.getByTestId('view-delete')).toHaveCount(0);
});

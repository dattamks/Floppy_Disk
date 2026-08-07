import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Row detail modal: expand a row into a focused card, edit every-typed fields
// there (text / number / single-select), navigate prev/next, and confirm edits
// land back in the grid and persist.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function addColumn(page, name, type) {
  await page.getByTestId('table-grid').getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill(name);
  await dlg.getByLabel('Column type').selectOption(type);
  await dlg.getByRole('button', { name: 'Add column' }).click();
}

async function expandRow(page, r) {
  const grid = page.getByTestId('table-grid');
  await grid.locator(`[data-gutter-r="${r}"]`).hover();
  await grid.locator(`[data-expand-r="${r}"]`).click();
  await expect(page.getByTestId('row-detail')).toBeVisible();
}

test('expand a row, edit fields in the modal, navigate, persist', async ({ page }) => {
  await registerNewUser(page);
  // First user is the instance Owner; the first-run storage setup can render a
  // beat after the app loads. Wait briefly for it, and dismiss if it shows.
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

  // Name(0) Notes(1) Status(2) + Priority(3, number).
  await addColumn(page, 'Priority', 'number');

  // Expand row 0 and edit its Name, Priority, and Status inside the modal.
  await expandRow(page, 0);
  const modal = page.getByTestId('row-detail');
  await modal.getByLabel('Name').fill('Alpha task');
  await modal.getByLabel('Priority').fill('5');
  await modal.getByRole('button', { name: 'In progress', exact: true }).click();
  // Title reflects the primary cell live.
  await expect(page.getByTestId('row-detail-title')).toHaveText('Alpha task');

  // Navigate to the next row; the title changes to the empty row's placeholder.
  await modal.getByRole('button', { name: 'Next row' }).click();
  await expect(page.getByTestId('row-detail-title')).toHaveText('Untitled');
  await modal.getByLabel('Name').fill('Beta task');
  await modal.getByLabel('Name').blur();
  await expect(page.getByTestId('row-detail-title')).toHaveText('Beta task');

  // Close; the grid shows both edits.
  await modal.getByTestId('row-detail-done').click();
  await expect(page.getByTestId('row-detail')).toHaveCount(0);
  await expect(grid.locator('[data-r="0"][data-c="0"]')).toContainText('Alpha task');
  await expect(grid.locator('[data-r="0"][data-c="3"]')).toContainText('5');
  await expect(grid.locator('[data-r="0"][data-c="2"]')).toContainText('In progress');
  await expect(grid.locator('[data-r="1"][data-c="0"]')).toContainText('Beta task');

  // Persist across a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  await expect(page.getByTestId('table-grid').locator('[data-r="0"][data-c="0"]')).toContainText('Alpha task');

  // Delete a row from the modal.
  await expandRow(page, 0);
  await page.getByTestId('row-detail').getByTestId('row-detail-delete').click();
  await expect(page.getByTestId('row-detail')).toHaveCount(0);
  await expect(page.getByTestId('table-grid').locator('[data-r][data-c="0"]')).toHaveCount(2);
});

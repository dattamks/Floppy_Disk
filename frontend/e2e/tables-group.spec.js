import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Grouping: group rows by a single-select field into collapsible bands; the
// grouping choice persists to the view config across a reload.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function pickSelect(page, grid, r, c, choice) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.dblclick();
  await page.getByRole('button', { name: choice, exact: true }).click();
}

test('group rows by a select field, collapse, and persist', async ({ page }) => {
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

  // Starter Status(2) single-select on the three starter rows: two Todo, one Done.
  await pickSelect(page, grid, 0, 2, 'Todo');
  await pickSelect(page, grid, 1, 2, 'Todo');
  await pickSelect(page, grid, 2, 2, 'Done');

  // Group by Status.
  await page.getByTestId('group-button').click();
  await page.getByTestId('group-menu').getByRole('button', { name: 'Status' }).click();

  // Two group bands appear (Todo, Done) with counts; button reflects it.
  await expect(page.getByTestId('group-button')).toContainText('Grouped by Status');
  await expect(grid.locator('[data-group-key]')).toHaveCount(2);
  await expect(grid.locator('[data-group-key]').first()).toContainText('Todo');
  await expect(grid.locator('[data-group-key]').first()).toContainText('2');
  // All three rows still render across the groups.
  await expect(grid.locator('[data-gutter-r]')).toHaveCount(3);

  // Collapse the first group (Todo): its 2 rows disappear, 1 remains (Done).
  await grid.locator('[data-group-toggle]').first().click();
  await expect(grid.locator('[data-gutter-r]')).toHaveCount(1);
  // Both group headers still show.
  await expect(grid.locator('[data-group-key]')).toHaveCount(2);

  // Grouping persists across a reload (collapse state is per-session).
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  await expect(page.getByTestId('group-button')).toContainText('Grouped by Status');
  await expect(page.getByTestId('table-grid').locator('[data-group-key]')).toHaveCount(2);
  await expect(page.getByTestId('table-grid').locator('[data-gutter-r]')).toHaveCount(3);

  // Remove grouping.
  await page.getByTestId('group-button').click();
  await page.getByTestId('group-menu').getByRole('button', { name: 'No grouping' }).click();
  await expect(page.getByTestId('table-grid').locator('[data-group-key]')).toHaveCount(0);
});

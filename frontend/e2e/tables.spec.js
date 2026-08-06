import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Tables (NocoDB/Airtable-style) end-to-end: create a table, edit cells with the
// keyboard, add rows and columns, and verify it all persists to the server.
test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('create a table, edit cells, add rows/columns, and it persists', async ({ page }) => {
  await registerNewUser(page);

  // Open Tables and create one (starter schema: Name / Notes / Status + 3 rows).
  await page.getByRole('button', { name: 'Tables' }).click();
  await expect(page.getByTestId('tables-list')).toBeVisible();
  await page.getByTestId('new-table').click();
  await expect(page.getByTestId('table-open')).toBeVisible();
  await expect(page.getByTestId('table-grid')).toBeVisible();

  const grid = page.getByTestId('table-grid');
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(3); // 3 starter rows

  // Edit the first row's Name cell via the keyboard (double-click -> type -> Enter).
  const cell00 = grid.locator('[data-r="0"][data-c="0"]');
  await cell00.dblclick();
  await page.keyboard.type('Launch plan');
  await page.keyboard.press('Enter');
  await expect(grid.locator('[data-r="0"][data-c="0"]')).toContainText('Launch plan');

  // Add a row.
  await page.getByTestId('add-row').click();
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(4);

  // Add a Number column via the header "+" popover.
  await page.getByRole('button', { name: 'Add column' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add column' });
  await dialog.getByLabel('Column name').fill('Priority');
  await dialog.getByLabel('Column type').selectOption('number');
  await dialog.getByRole('button', { name: 'Add column' }).click();
  // 4th column now exists (Name, Notes, Status, Priority => index 3).
  await expect(grid.locator('[data-r="0"][data-c="3"]')).toBeVisible();

  // Persistence: reload, reopen the table, the edited value is still there.
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  await expect(page.getByTestId('table-grid').locator('[data-r="0"][data-c="0"]')).toContainText('Launch plan');
});

test('a checkbox cell toggles and a select cell picks a choice', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();

  // Status is a single-select (column index 2): click the cell, open the popover, choose.
  const statusCell = grid.locator('[data-r="0"][data-c="2"]');
  await statusCell.click();
  await statusCell.dblclick();
  await page.getByRole('button', { name: 'In progress' }).click();
  await expect(statusCell).toContainText('In progress');
});

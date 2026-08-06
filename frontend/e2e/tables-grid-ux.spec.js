import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Phase-2 grid UX: column sorting, row multi-select + bulk delete, and undo.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function newTableWithNames(page, names) {
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();
  for (let r = 0; r < names.length; r++) {
    const cell = grid.locator(`[data-r="${r}"][data-c="0"]`);
    await cell.dblclick();
    await page.keyboard.type(names[r]);
    await page.keyboard.press('Enter');
  }
  return grid;
}

test('clicking a column header sorts the rows', async ({ page }) => {
  await registerNewUser(page);
  const grid = await newTableWithNames(page, ['Banana', 'Apple', 'Cherry']);

  // Sort ascending by Name -> Apple first.
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  await expect(grid.locator('[data-r="0"][data-c="0"]')).toContainText('Apple');
  await expect(grid.locator('[data-r="2"][data-c="0"]')).toContainText('Cherry');

  // Toggle to descending -> Cherry first.
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  await expect(grid.locator('[data-r="0"][data-c="0"]')).toContainText('Cherry');
});

test('select rows, bulk delete, then undo restores them', async ({ page }) => {
  await registerNewUser(page);
  const grid = await newTableWithNames(page, ['One', 'Two', 'Three']);
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(3);

  // Select all via the header checkbox, then bulk delete.
  await page.getByRole('button', { name: 'Select all rows' }).click();
  await expect(page.getByTestId('row-selection-bar')).toContainText('3 selected');
  await page.getByTestId('bulk-delete').click();
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(0);

  // Undo (Ctrl+Z) brings the rows back.
  await page.keyboard.press('Control+z');
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(3);
  await expect(grid.getByText('One')).toBeVisible();
});

test('shift-click selects a range of rows', async ({ page }) => {
  await registerNewUser(page);
  const grid = await newTableWithNames(page, ['a', 'b', 'c']);
  // Click row 0 gutter, shift-click row 2 gutter -> 3 selected.
  await grid.locator('[data-gutter-r="0"]').click();
  await grid.locator('[data-gutter-r="2"]').click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('row-selection-bar')).toContainText('3 selected');
});

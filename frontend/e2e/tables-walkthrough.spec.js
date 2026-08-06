import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// A recorded, human-paced walkthrough of the Tables feature - used to produce a
// demo video. It exercises the real UX a user would: create a table, name it,
// fill typed cells (text / select / number / checkbox) with the keyboard, add
// rows and columns, delete a row, and return to the list.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });

const beat = (page, ms = 550) => page.waitForTimeout(ms);

async function typeCell(page, grid, r, c, text) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.scrollIntoViewIfNeeded();
  await cell.dblclick();
  await page.keyboard.type(text, { delay: 28 });
  await page.keyboard.press('Enter');
}

async function pickSelect(page, grid, r, c, choice) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.click();
  await cell.dblclick();
  await page.getByRole('button', { name: choice, exact: true }).click();
}

test('Tables walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await beat(page);

  // Open the Tables surface and create a table.
  await page.getByRole('button', { name: 'Tables' }).click();
  await expect(page.getByTestId('tables-list')).toBeVisible();
  await beat(page);
  await page.getByTestId('new-table').click();
  await expect(page.getByTestId('table-grid')).toBeVisible();
  await beat(page);

  // Name the table.
  const title = page.getByLabel('Table name');
  await title.click();
  await title.fill('');
  await page.keyboard.type('Product Launch', { delay: 30 });
  await page.keyboard.press('Enter');
  await beat(page);

  const grid = page.getByTestId('table-grid');

  // Fill the three starter rows: Name (text) + Status (single-select).
  await typeCell(page, grid, 0, 0, 'Landing page');
  await pickSelect(page, grid, 0, 2, 'In progress');
  await beat(page, 350);
  await typeCell(page, grid, 1, 0, 'Pricing tiers');
  await pickSelect(page, grid, 1, 2, 'Todo');
  await beat(page, 350);
  await typeCell(page, grid, 2, 0, 'Launch docs');
  await pickSelect(page, grid, 2, 2, 'Done');
  await beat(page);

  // Add a Number column "Priority".
  await page.getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill('Priority');
  await dlg.getByLabel('Column type').selectOption('number');
  await dlg.getByRole('button', { name: 'Add column' }).click();
  await beat(page);

  // Add a Checkbox column "Blocked".
  await page.getByRole('button', { name: 'Add column' }).click();
  const dlg2 = page.getByRole('dialog', { name: 'Add column' });
  await dlg2.getByLabel('Column name').fill('Blocked');
  await dlg2.getByLabel('Column type').selectOption('checkbox');
  await dlg2.getByRole('button', { name: 'Add column' }).click();
  await beat(page);

  // Fill priorities (column 3) and toggle a checkbox (column 4).
  await typeCell(page, grid, 0, 3, '1');
  await typeCell(page, grid, 1, 3, '2');
  await typeCell(page, grid, 2, 3, '3');
  await grid.locator('[data-r="1"][data-c="4"]').getByRole('button', { name: 'Toggle' }).click();
  await beat(page);

  // Add a new row and fill it.
  await page.getByTestId('add-row').click();
  await typeCell(page, grid, 3, 0, 'Press kit');
  await pickSelect(page, grid, 3, 2, 'Todo');
  await beat(page);

  // Delete the last row (hover the row-number gutter to reveal the trash).
  await grid.locator('[data-gutter-r="3"]').hover();
  await grid.getByRole('button', { name: 'Delete row 4' }).click();
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(3);
  await beat(page);

  // Back to the list - the table shows with its row count - then reopen.
  await page.getByRole('button', { name: 'Back to tables' }).click();
  await expect(page.getByTestId('table-card')).toContainText('Product Launch');
  await beat(page);
  await page.getByTestId('table-card').first().click();
  await expect(grid.locator('[data-r="0"][data-c="0"]')).toContainText('Landing page');
  await beat(page, 900);
});

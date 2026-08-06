import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Phase-2 field types: currency, percent, rating, multi-select, url.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function addColumn(page, name, type) {
  await page.getByTestId('table-grid').getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill(name);
  await dlg.getByLabel('Column type').selectOption(type);
  await dlg.getByRole('button', { name: 'Add column' }).click();
}
async function typeCell(page, grid, c, text) {
  const cell = grid.locator(`[data-r="0"][data-c="${c}"]`);
  await cell.dblclick();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  return cell;
}

test('currency, percent, rating, multi-select, and url columns work', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();

  // Starter columns are Name(0) Notes(1) Status(2); new ones append at 3,4,5,6,7.
  await addColumn(page, 'Price', 'currency');
  await addColumn(page, 'Progress', 'percent');
  await addColumn(page, 'Stars', 'rating');
  await addColumn(page, 'Tags', 'multi_select');
  await addColumn(page, 'Site', 'url');

  // Currency + percent format on display.
  await expect(await typeCell(page, grid, 3, '1200')).toContainText('$1200');
  await expect(await typeCell(page, grid, 4, '80')).toContainText('80%');

  // Rating: click the 4th star -> 4 filled.
  const rating = grid.locator('[data-r="0"][data-c="5"]');
  await rating.getByRole('button', { name: 'Rate 4' }).click();
  await expect(rating.locator('[data-filled]')).toHaveCount(4);

  // Multi-select: open the popover, pick two options.
  const tags = grid.locator('[data-r="0"][data-c="6"]');
  await tags.dblclick();
  await page.getByRole('button', { name: 'Option 1' }).click();
  await page.getByRole('button', { name: 'Option 3' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(tags).toContainText('Option 1');
  await expect(tags).toContainText('Option 3');

  // URL renders as a link.
  await typeCell(page, grid, 7, 'example.com');
  await expect(grid.locator('[data-r="0"][data-c="7"] a')).toHaveAttribute('href', 'https://example.com');

  // Persistence across a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  const grid2 = page.getByTestId('table-grid');
  await expect(grid2.locator('[data-r="0"][data-c="3"]')).toContainText('$1200');
  await expect(grid2.locator('[data-r="0"][data-c="5"] [data-filled]')).toHaveCount(4);
  await expect(grid2.locator('[data-r="0"][data-c="6"]')).toContainText('Option 3');
});

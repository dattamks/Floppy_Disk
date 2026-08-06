import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// A single recorded, human-paced walkthrough that exercises EVERY Tables
// feature built this phase - used to produce the evidence video. It covers:
//   - relation across two tables (People <- Q3 Launch.Owner)
//   - field types: text, single-select, number, currency, percent, rating,
//     multi-select, url, checkbox, relation, formula (computed)
//   - grid UX: column sort, row multi-select, bulk delete, undo, add row
//   - persistence: re-open the table from the list
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });

const beat = (page, ms = 500) => page.waitForTimeout(ms);

async function typeCell(page, grid, r, c, text) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.scrollIntoViewIfNeeded();
  await cell.dblclick();
  await page.keyboard.type(text, { delay: 24 });
  await page.keyboard.press('Enter');
}

async function pickSelect(page, grid, r, c, choice) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.scrollIntoViewIfNeeded();
  await cell.dblclick();
  await page.getByRole('button', { name: choice, exact: true }).click();
}

async function addColumn(page, name, type, opts = {}) {
  await page.getByTestId('table-grid').getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill(name);
  await dlg.getByLabel('Column type').selectOption(type);
  if (opts.linkedTable) await dlg.getByLabel('Linked table').selectOption({ label: opts.linkedTable });
  if (opts.expr) await dlg.getByLabel('Formula expression').fill(opts.expr);
  await dlg.getByRole('button', { name: 'Add column' }).click();
  await beat(page, 320);
}

test('Tables evidence walkthrough - every field type + grid UX', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await beat(page);

  // First user is the instance Owner; the first-run storage setup can appear a
  // beat late. Dismiss it if it's up so it doesn't intercept clicks.
  const setup = page.getByTestId('setup-modal');
  if (await setup.isVisible().catch(() => false)) {
    await page.getByTestId('setup-skip').click();
    await setup.waitFor({ state: 'hidden' }).catch(() => {});
    await beat(page);
  }

  // ---- Table 1: People (relation target) ----
  await page.getByRole('button', { name: 'Tables' }).click();
  await expect(page.getByTestId('tables-list')).toBeVisible();
  await beat(page);
  await page.getByTestId('new-table').click();
  let grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();
  const t1 = page.getByLabel('Table name');
  await t1.click(); await t1.fill(''); await page.keyboard.type('People', { delay: 30 }); await page.keyboard.press('Enter');
  await typeCell(page, grid, 0, 0, 'Alice Chen');
  await typeCell(page, grid, 1, 0, 'Ben Ortiz');
  await beat(page);
  await page.getByRole('button', { name: 'Back to tables' }).click();
  await beat(page);

  // ---- Table 2: Q3 Launch (the rich table) ----
  await page.getByTestId('new-table').click();
  grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();
  const t2 = page.getByLabel('Table name');
  await t2.click(); await t2.fill(''); await page.keyboard.type('Q3 Launch', { delay: 30 }); await page.keyboard.press('Enter');
  await beat(page);

  // Starter columns: Name(0, text) Notes(1, long_text) Status(2, single-select).
  await typeCell(page, grid, 0, 0, 'Landing page');
  await pickSelect(page, grid, 0, 2, 'In progress');
  await typeCell(page, grid, 1, 0, 'Pricing tiers');
  await pickSelect(page, grid, 1, 2, 'Todo');
  await typeCell(page, grid, 2, 0, 'Launch docs');
  await pickSelect(page, grid, 2, 2, 'Done');
  await beat(page);

  // Add every remaining field type. Indices append at 3..12.
  await addColumn(page, 'Priority', 'number');       // 3
  await addColumn(page, 'Budget', 'currency');       // 4
  await addColumn(page, 'Progress', 'percent');      // 5
  await addColumn(page, 'Rating', 'rating');         // 6
  await addColumn(page, 'Tags', 'multi_select');     // 7
  await addColumn(page, 'Site', 'url');              // 8
  await addColumn(page, 'Blocked', 'checkbox');      // 9
  await addColumn(page, 'Owner', 'relation', { linkedTable: 'People' }); // 10
  await addColumn(page, 'Total', 'formula', { expr: '{Budget} * {Priority}' }); // 11
  await beat(page);

  // Fill row 0 across the typed columns.
  await typeCell(page, grid, 0, 3, '2');      // Priority
  await typeCell(page, grid, 0, 4, '5000');   // Budget -> $5000
  await expect(grid.locator('[data-r="0"][data-c="4"]')).toContainText('$5000');
  await typeCell(page, grid, 0, 5, '40');     // Progress -> 40%
  await expect(grid.locator('[data-r="0"][data-c="5"]')).toContainText('40%');

  // Formula Total computes live from Budget * Priority = 10000.
  await expect(grid.locator('[data-r="0"][data-c="11"]')).toContainText('10000');
  await beat(page);

  // Rating: click the 4th star.
  const rating = grid.locator('[data-r="0"][data-c="6"]');
  await rating.getByRole('button', { name: 'Rate 4' }).click();
  await expect(rating.locator('[data-filled]')).toHaveCount(4);

  // Multi-select tags.
  const tags = grid.locator('[data-r="0"][data-c="7"]');
  await tags.dblclick();
  await page.getByRole('button', { name: 'Option 1', exact: true }).click();
  await page.getByRole('button', { name: 'Option 3', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(tags).toContainText('Option 1');
  await beat(page);

  // URL renders a link.
  await typeCell(page, grid, 0, 8, 'launch.example.com');
  await expect(grid.locator('[data-r="0"][data-c="8"] a')).toHaveAttribute('href', 'https://launch.example.com');

  // Checkbox toggle.
  await grid.locator('[data-r="0"][data-c="9"]').getByRole('button', { name: 'Toggle' }).click();

  // Relation: link Alice.
  const owner = grid.locator('[data-r="0"][data-c="10"]');
  await owner.dblclick();
  await page.getByRole('button', { name: 'Alice Chen', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(owner).toContainText('Alice Chen');
  await beat(page);

  // Give rows 1 and 2 priorities so the sort is visible.
  await typeCell(page, grid, 1, 3, '5');
  await typeCell(page, grid, 2, 3, '1');
  await beat(page);

  // ---- Grid UX: sort by Priority (asc), then again (desc) ----
  await page.getByRole('button', { name: 'Sort by Priority' }).click();
  await beat(page);
  // asc -> row with Priority 1 (Launch docs) floats to the top.
  await expect(grid.locator('[data-r="0"][data-c="0"]')).toContainText('Launch docs');
  await page.getByRole('button', { name: 'Sort by Priority' }).click();
  await beat(page);
  // desc -> Priority 5 (Pricing tiers) to the top.
  await expect(grid.locator('[data-r="0"][data-c="0"]')).toContainText('Pricing tiers');
  // Clear sort back to insertion order.
  await page.getByRole('button', { name: 'Sort by Priority' }).click();
  await beat(page);

  // ---- Add a row, then multi-select + bulk delete + undo ----
  await page.getByTestId('add-row').click();
  await typeCell(page, grid, 3, 0, 'Press kit');
  await beat(page);

  // Select rows 2 and 3 (shift-range), delete them.
  await grid.locator('[data-gutter-r="2"]').click();
  await grid.locator('[data-gutter-r="3"]').click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('row-selection-bar')).toContainText('2 selected');
  await beat(page);
  await page.getByTestId('bulk-delete').click();
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(2);
  await beat(page);

  // Undo restores them.
  await page.keyboard.press('Control+z');
  await expect(grid.locator('[data-r][data-c="0"]')).toHaveCount(4);
  await beat(page);

  // ---- Persistence: back to list, reopen ----
  await page.getByRole('button', { name: 'Back to tables' }).click();
  await expect(page.getByTestId('table-card').filter({ hasText: 'Q3 Launch' })).toBeVisible();
  await beat(page);
  await page.getByTestId('table-card').filter({ hasText: 'Q3 Launch' }).click();
  await expect(grid.locator('[data-r="0"][data-c="4"]')).toContainText('$5000');
  await expect(grid.locator('[data-r="0"][data-c="11"]')).toContainText('10000');
  await beat(page, 900);
});

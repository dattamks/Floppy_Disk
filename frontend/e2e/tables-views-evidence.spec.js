import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Recorded, human-paced evidence of the four new Tables view features:
// row-detail modal, filtering, grouping (collapsible), and the Kanban board.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });

const beat = (page, ms = 550) => page.waitForTimeout(ms);

async function typeCell(page, grid, r, c, text) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.scrollIntoViewIfNeeded();
  await cell.dblclick();
  await page.keyboard.type(text, { delay: 24 });
  await page.keyboard.press('Enter');
}
async function pickSelect(page, grid, r, c, choice) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.dblclick();
  await page.getByRole('button', { name: choice, exact: true }).click();
}

test('Tables views evidence — row detail, filter, group, board', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }
  await beat(page);

  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();
  const title = page.getByLabel('Table name');
  await title.click(); await title.fill(''); await page.keyboard.type('Sprint Board', { delay: 26 }); await page.keyboard.press('Enter');
  await beat(page);

  // A Points (number) column + fill the three starter rows.
  await grid.getByRole('button', { name: 'Add column' }).click();
  let dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill('Points');
  await dlg.getByLabel('Column type').selectOption('number');
  await dlg.getByRole('button', { name: 'Add column' }).click();
  await beat(page, 300);

  await typeCell(page, grid, 0, 0, 'Design system'); await pickSelect(page, grid, 0, 2, 'In progress'); await typeCell(page, grid, 0, 3, '8');
  await typeCell(page, grid, 1, 0, 'Auth flow'); await pickSelect(page, grid, 1, 2, 'Todo'); await typeCell(page, grid, 1, 3, '3');
  await typeCell(page, grid, 2, 0, 'Billing'); await pickSelect(page, grid, 2, 2, 'Done'); await typeCell(page, grid, 2, 3, '13');
  await beat(page);

  // 1) Row-detail modal — expand row 0, tweak a field, navigate, close.
  await grid.locator('[data-gutter-r="0"]').hover();
  await grid.locator('[data-expand-r="0"]').click();
  const modal = page.getByTestId('row-detail');
  await expect(modal).toBeVisible();
  await beat(page);
  await modal.getByLabel('Points').fill('5'); await modal.getByLabel('Points').blur();
  await beat(page, 350);
  await modal.getByRole('button', { name: 'Next row' }).click();
  await beat(page, 500);
  await modal.getByTestId('row-detail-done').click();
  await beat(page);

  // 2) Filtering — Points >= 5 hides the low-point row.
  await page.getByTestId('filter-button').click();
  const panel = page.getByTestId('filter-panel');
  await panel.getByTestId('filter-add').click();
  await panel.getByLabel('Filter field').selectOption({ label: 'Points' });
  await panel.getByLabel('Filter operator').selectOption('gte');
  await panel.getByLabel('Filter value').fill('5');
  await beat(page, 600);
  await expect(page.getByTestId('row-count')).toContainText('of');
  // Dismiss the panel with an outside click, then clear the filter.
  await page.getByLabel('Table name').click();
  await beat(page, 400);
  await page.getByTestId('filter-button').click();
  await page.getByTestId('filter-clear').click();
  await page.getByLabel('Table name').click();
  await beat(page);

  // 3) Grouping — group by Status, collapse a band, then ungroup.
  await page.getByTestId('group-button').click();
  await page.getByTestId('group-menu').getByRole('button', { name: 'Status' }).click();
  await beat(page, 700);
  await grid.locator('[data-group-toggle]').first().click();
  await beat(page, 600);
  await grid.locator('[data-group-toggle]').first().click();
  await beat(page, 400);
  await page.getByTestId('group-button').click();
  await page.getByTestId('group-menu').getByRole('button', { name: 'No grouping' }).click();
  await beat(page);

  // 4) Kanban board — add a Board view, drag a card, add a card, open a card.
  await page.getByTestId('add-view').click();
  await page.getByTestId('add-view-kanban').click();
  const board = page.getByTestId('kanban-board');
  await expect(board).toBeVisible();
  await beat(page);
  const todo = board.locator('[data-kanban-col]').filter({ hasText: 'Todo' });
  const done = board.locator('[data-kanban-col]').filter({ hasText: 'Done' });
  await todo.locator('[data-kanban-card]').filter({ hasText: 'Auth flow' }).dragTo(done);
  await beat(page, 700);
  await board.locator('[data-kanban-col]').filter({ hasText: 'In progress' }).getByRole('button', { name: /Add card/ }).click();
  await beat(page, 500);
  await done.locator('[data-kanban-card]').filter({ hasText: 'Auth flow' }).click();
  await expect(page.getByTestId('row-detail')).toBeVisible();
  await beat(page, 700);
  await page.getByTestId('row-detail-done').click();
  await beat(page, 900);
});

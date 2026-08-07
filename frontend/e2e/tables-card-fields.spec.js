import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Per-board card curation: choose which fields appear on a board's cards.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function addColumn(page, name, type) {
  await page.getByTestId('table-grid').getByRole('button', { name: 'Add column' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add column' });
  await dlg.getByLabel('Column name').fill(name);
  await dlg.getByLabel('Column type').selectOption(type);
  await dlg.getByRole('button', { name: 'Add column' }).click();
}
async function typeCell(page, grid, r, c, text) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.dblclick();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('a board view can choose which fields show on its cards', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  const grid = page.getByTestId('table-grid');
  await expect(grid).toBeVisible();

  // Name(0) Notes(1) Status(2) + Owner(3) + Points(4). Fill row 0.
  await addColumn(page, 'Owner', 'text');
  await addColumn(page, 'Points', 'number');
  await typeCell(page, grid, 0, 0, 'Task A');
  await typeCell(page, grid, 0, 3, 'Alice');
  await typeCell(page, grid, 0, 4, '8');

  // Board view.
  await page.getByTestId('add-view').click();
  await page.getByTestId('add-view-kanban').click();
  const board = page.getByTestId('kanban-board');
  await expect(board).toBeVisible();
  const card = board.locator('[data-kanban-card]').filter({ hasText: 'Task A' });
  await expect(card).toBeVisible();

  // Open the card-fields menu; the candidates are non-primary, non-column fields.
  await page.getByTestId('cards-button').click();
  const menu = page.getByTestId('cards-menu');
  await expect(menu).toBeVisible();

  // Turn everything off, then show only "Points" -> card shows Points, not Owner.
  // (Default shows the first few; toggle off Owner + Notes, leave Points on.)
  await menu.getByTestId('card-field-toggle').filter({ hasText: 'Owner' }).click();
  await menu.getByTestId('card-field-toggle').filter({ hasText: 'Notes' }).click();
  await page.getByLabel('Table name').click(); // dismiss

  await expect(card).toContainText('Points');
  await expect(card).not.toContainText('Owner');

  // The card config persists across a reload (reopen -> Board tab).
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  await page.getByTestId('view-tabs').locator('[data-view-kind="kanban"]').first().click();
  const card2 = page.getByTestId('kanban-board').locator('[data-kanban-card]').filter({ hasText: 'Task A' });
  await expect(card2).toContainText('Points');
  await expect(card2).not.toContainText('Owner');
});

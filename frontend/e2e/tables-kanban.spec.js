import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Kanban board: switch a table to the board, drag a card between columns to
// change its single-select value, add a card into a column, open a card into the
// row-detail modal, and confirm the board mode persists across a reload.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function pickSelect(page, grid, r, c, choice) {
  const cell = grid.locator(`[data-r="${r}"][data-c="${c}"]`);
  await cell.dblclick();
  await page.getByRole('button', { name: choice, exact: true }).click();
}

test('board view: drag between columns, add card, open card, persist', async ({ page }) => {
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

  // Name row 0 and set its Status (single-select, col 2) to Todo.
  const c0 = grid.locator('[data-r="0"][data-c="0"]');
  await c0.dblclick();
  await page.keyboard.type('Task A');
  await page.keyboard.press('Enter');
  await pickSelect(page, grid, 0, 2, 'Todo');

  // Switch to the board. Columns come from Status.
  await page.getByTestId('view-kanban').click();
  const board = page.getByTestId('kanban-board');
  await expect(board).toBeVisible();
  await expect(page.getByTestId('kanban-field')).toHaveValue(/.+/);

  // The card sits in the Todo column.
  const todoCol = board.locator('[data-kanban-col]').filter({ hasText: 'Todo' });
  const doneCol = board.locator('[data-kanban-col]').filter({ hasText: 'Done' });
  await expect(todoCol.locator('[data-kanban-card]').filter({ hasText: 'Task A' })).toBeVisible();

  // Drag the card from Todo to Done -> its Status becomes Done.
  await todoCol.locator('[data-kanban-card]').filter({ hasText: 'Task A' }).dragTo(doneCol);
  await expect(doneCol.locator('[data-kanban-card]').filter({ hasText: 'Task A' })).toBeVisible();
  await expect(todoCol.locator('[data-kanban-card]').filter({ hasText: 'Task A' })).toHaveCount(0);

  // Add a card into the "In progress" column.
  const progCol = board.locator('[data-kanban-col]').filter({ hasText: 'In progress' });
  await progCol.getByRole('button', { name: /Add card/ }).click();
  await expect(progCol.locator('[data-kanban-card]')).toHaveCount(1);

  // Open the Task A card -> the row-detail modal.
  await doneCol.locator('[data-kanban-card]').filter({ hasText: 'Task A' }).click();
  await expect(page.getByTestId('row-detail')).toBeVisible();
  await expect(page.getByTestId('row-detail-title')).toHaveText('Task A');
  await page.getByTestId('row-detail-done').click();

  // Board mode persists across a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('table-card').first().click();
  await expect(page.getByTestId('kanban-board')).toBeVisible();
  // Task A is still in Done after the drag persisted.
  await expect(page.getByTestId('kanban-board').locator('[data-kanban-col]').filter({ hasText: 'Done' })
    .locator('[data-kanban-card]').filter({ hasText: 'Task A' })).toBeVisible();

  // Back to grid.
  await page.getByTestId('view-grid').click();
  await expect(page.getByTestId('table-grid')).toBeVisible();
});

import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Table editing (add/delete rows & columns, delete table) + the checkbox layout
// fix (text sits beside the checkbox, not on the next line).
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 550) => page.waitForTimeout(ms);

async function slash(page, q, pick) {
  await page.keyboard.type('/' + q, { delay: 25 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 220);
  await page.getByTestId('slash-item').filter({ hasText: pick }).click();
}

test('table controls + checkbox layout', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Tables & checks');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await beat(page);

  // Insert a table + fill a couple cells.
  await slash(page, 'table', 'Table');
  const table = editor.locator('table');
  await expect(table).toBeVisible();
  await expect(editor.locator('table tr')).toHaveCount(3);
  await page.keyboard.type('Area', { delay: 12 });
  await page.keyboard.press('Tab');
  await page.keyboard.type('Owner', { delay: 12 });
  await beat(page, 500);

  // Drag a column border to resize it (visual — the columns are drag-resizable).
  const c0 = await editor.locator('table th, table td').first().boundingBox();
  if (c0) {
    await page.mouse.move(c0.x + c0.width - 1, c0.y + c0.height / 2);
    await beat(page, 250);
    await page.mouse.down();
    await page.mouse.move(c0.x + c0.width + 120, c0.y + c0.height / 2, { steps: 14 });
    await page.mouse.up();
    await beat(page, 700);
  }

  // Table toolbar appears; add a row and a column.
  await editor.locator('table th, table td').first().click();
  const tools = page.getByTestId('table-tools');
  await expect(tools).toBeVisible();
  await beat(page, 500);
  await page.getByTestId('table-add-row').click();
  await expect(editor.locator('table tr')).toHaveCount(4);
  await beat(page, 400);
  const cols = await editor.locator('table tr').first().locator('th, td').count();
  await page.getByTestId('table-add-col').click();
  await expect(editor.locator('table tr').first().locator('th, td')).toHaveCount(cols + 1);
  await beat(page, 500);

  // Delete a row, then delete the whole table.
  await page.getByTestId('table-del-row').click();
  await expect(editor.locator('table tr')).toHaveCount(3);
  await beat(page, 500);
  await page.getByTestId('table-delete').click();
  await expect(editor.locator('table')).toHaveCount(0);
  await beat(page, 500);

  // Checkbox layout: the text must sit BESIDE the checkbox (same line).
  await editor.click();
  await slash(page, 'todo', 'To-do list');
  await page.keyboard.type('Review the table controls', { delay: 12 });
  await beat(page, 400);
  const label = editor.locator('ul[data-type="taskList"] li > label').first();
  const textBox = editor.locator('ul[data-type="taskList"] li > div').first();
  const lb = await label.boundingBox();
  const tb = await textBox.boundingBox();
  expect(Math.abs(lb.y - tb.y)).toBeLessThan(16); // same line
  expect(tb.x).toBeGreaterThan(lb.x); // text is to the right of the checkbox
  await beat(page, 900);
});

import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// The note editor's slash-command menu: type "/" to turn the current line into a
// heading / list / quote etc. (Notion-style), with Markdown storage unchanged.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('slash menu turns a line into a heading and a to-do', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByLabel('Note title')).toBeVisible({ timeout: 10000 });
  const editor = page.locator('.ProseMirror');
  await editor.waitFor({ timeout: 15000 });
  await editor.click();

  // "/" opens the menu; typing filters it.
  await page.keyboard.type('/');
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.keyboard.type('head');
  await expect(page.getByTestId('slash-item').first()).toContainText('Heading 1');
  await page.keyboard.press('Enter'); // pick Heading 1
  await expect(page.getByTestId('slash-menu')).toHaveCount(0);
  await page.keyboard.type('Project plan');
  await expect(page.getByRole('heading', { name: 'Project plan' })).toBeVisible();

  // New line -> slash -> To-do list (picked by mouse click).
  await page.keyboard.press('Enter');
  await page.keyboard.type('/todo');
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.getByTestId('slash-item').filter({ hasText: 'To-do list' }).click();
  await page.keyboard.type('Ship it');
  await expect(editor.locator('ul[data-type="taskList"]')).toContainText('Ship it');

  // The stored Markdown reflects the blocks (heading + task) — graph-safe format.
  await page.getByTestId('file-page-source').click();
  const md = await page.locator('textarea').first().inputValue();
  expect(md).toMatch(/# Project plan/);
  expect(md).toMatch(/- \[ \] Ship it/);
});

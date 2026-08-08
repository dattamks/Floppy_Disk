import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Advanced blocks: KaTeX math (inline via slash-block), side-by-side columns,
// the ":" emoji picker, and the grouped/iconed slash menu. Everything survives
// save → reload.
test.use({ video: { mode: 'on', size: { width: 1360, height: 900 } }, viewport: { width: 1360, height: 900 } });
const beat = (page, ms = 450) => page.waitForTimeout(ms);

async function toEnd(page) {
  const p = page.locator('.ProseMirror > p').last();
  await p.click();
  await page.keyboard.press('End');
  const t = (await p.textContent()) || '';
  if (t.trim().length) await page.keyboard.press('Enter');
  await beat(page, 120);
}
async function slash(page, query, label) {
  await page.keyboard.type('/' + query, { delay: 16 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 200);
  await page.getByTestId('slash-item').filter({ hasText: label }).first().click();
  await beat(page, 240);
}

test('math, columns, emoji, grouped slash menu + round-trip', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Advanced blocks');
  const ed = page.locator('.ProseMirror');
  await ed.click();

  // Grouped, iconed slash menu: headers are present.
  await page.keyboard.type('/', { delay: 12 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await expect(page.getByTestId('slash-menu')).toContainText('Basic');
  await expect(page.getByTestId('slash-menu')).toContainText('Media');
  await beat(page, 300);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backspace'); // remove the "/"

  // Math block.
  await slash(page, 'math', /^Math block$/);
  await page.getByTestId('note-math-input').fill('E = mc^2');
  await page.getByLabel('Note title').click(); // blur → render
  await beat(page, 300);
  await expect(ed.locator('.note-math-block math').first()).toBeVisible({ timeout: 10000 });
  await beat(page, 400);

  // Columns.
  await toEnd(page);
  await slash(page, 'columns', /^Two columns$/);
  await expect(ed.locator('.note-columns')).toBeVisible();
  await expect(ed.locator('.note-column')).toHaveCount(2);
  await ed.locator('.note-column').first().click();
  await page.keyboard.type('Left side', { delay: 8 });
  await ed.locator('.note-column').nth(1).click();
  await page.keyboard.type('Right side', { delay: 8 });
  await beat(page, 400);

  // Emoji picker.
  await toEnd(page);
  await page.keyboard.type('Status: ', { delay: 8 });
  await page.keyboard.type(':fire', { delay: 25 });
  await expect(page.getByTestId('emoji-menu')).toBeVisible();
  await beat(page, 300);
  await page.getByTestId('emoji-item').first().click();
  await expect(ed).toContainText('🔥');
  await beat(page, 400);

  // Save + inspect the persisted Markdown.
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('file-page-source').click();
  const raw = await page.locator('textarea').first().inputValue();
  expect(raw).toContain('$$');
  expect(raw).toContain('E = mc^2');
  expect(raw).toContain('data-columns');
  expect(raw).toContain('🔥');
  await page.getByTestId('file-page-source').click();
  await beat(page, 300);

  // Reload + reopen: math + columns still render.
  await page.reload();
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) await page.getByTestId('setup-skip').click();
  await page.getByText('Advanced blocks', { exact: false }).first().click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await expect(ed.locator('.note-math-block math').first()).toBeVisible({ timeout: 10000 });
  await expect(ed.locator('.note-columns')).toBeVisible();
  await expect(ed.locator('.note-column')).toHaveCount(2);
  await expect(ed).toContainText('🔥');
  await beat(page, 500);
});

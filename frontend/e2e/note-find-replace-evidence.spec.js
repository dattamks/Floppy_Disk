import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// In-note find & replace: ⌘/Ctrl-F opens the bar, matches are counted and
// highlighted, you can step through them, and replace one or all.
test.use({ video: { mode: 'on', size: { width: 1280, height: 820 } }, viewport: { width: 1280, height: 820 } });
const beat = (page, ms = 400) => page.waitForTimeout(ms);

test('find and replace within a note', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Find and replace');
  const ed = page.locator('.ProseMirror');
  await ed.click();
  await page.keyboard.type('The cat sat down. Another cat appeared. A third cat ran off.', { delay: 6 });
  await beat(page);

  // Open the bar.
  await page.keyboard.press('Control+f');
  await expect(page.getByTestId('note-find')).toBeVisible();
  await page.getByTestId('note-find-input').fill('cat');
  await beat(page, 300);
  await expect(page.getByTestId('note-find-count')).toHaveText('1/3');
  await expect(ed.locator('.search-match, .search-current')).toHaveCount(3);
  await beat(page, 300);

  // Step through.
  await page.getByTestId('note-find-next').click();
  await expect(page.getByTestId('note-find-count')).toHaveText('2/3');
  await beat(page, 300);

  // Replace the current one.
  await page.getByTestId('note-replace-input').fill('dog');
  await page.getByTestId('note-replace-one').click();
  await expect(page.getByTestId('note-find-count')).toHaveText(/\/2$/); // two matches remain
  await beat(page, 300);

  // Replace the rest.
  await page.getByTestId('note-replace-all').click();
  await expect(page.getByTestId('note-find-count')).toHaveText('0/0');
  await beat(page, 300);

  await expect(ed).toContainText('The dog sat down. Another dog appeared. A third dog ran off.');
  await expect(ed).not.toContainText('cat');

  // Close.
  await page.getByTestId('note-find-close').click();
  await expect(page.getByTestId('note-find')).toBeHidden();
  await beat(page, 300);
});

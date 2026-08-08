import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Editing keyboard shortcuts work inside a note: undo (⌘/Ctrl-Z), redo
// (⌘/Ctrl-⇧-Z), and find & replace (⌘/Ctrl-F). Cut/copy/paste are the browser's
// native contentEditable shortcuts and are exercised implicitly by ProseMirror.
test.use({ viewport: { width: 1280, height: 820 } });
const beat = (page, ms = 300) => page.waitForTimeout(ms);

test('note keyboard shortcuts: undo, redo, find', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  const ed = page.locator('.ProseMirror');
  await ed.click();

  await page.keyboard.type('first line', { delay: 8 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('second line', { delay: 8 });
  await expect(ed).toContainText('second line');
  await beat(page);

  // Undo removes the last typing; redo restores it.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(ed).not.toContainText('second line');
  await beat(page);
  await page.keyboard.press('Control+Shift+z');
  await expect(ed).toContainText('second line');
  await beat(page);

  // Find & replace opens with Ctrl-F.
  await page.keyboard.press('Control+f');
  await expect(page.getByTestId('note-find')).toBeVisible();
  await page.getByTestId('note-find-input').fill('line');
  await expect(page.getByTestId('note-find-count')).toHaveText('1/2');
  await page.getByTestId('note-find-close').click();
  await expect(page.getByTestId('note-find')).toBeHidden();
});

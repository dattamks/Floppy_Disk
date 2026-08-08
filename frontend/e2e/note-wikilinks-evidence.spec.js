import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Obsidian-parity pass 2: inline [[wiki-links]]. Typing "[[" opens an
// autocomplete of existing note titles; accepting it writes [[Title]], which
// renders as a colored, clickable link (brackets dimmed). Clicking opens the
// target note. The doc still stores literal [[Title]] so the graph is intact.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 500) => page.waitForTimeout(ms);

test('wiki-links: autocomplete, render, open', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);

  // Note A — the link target.
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Aurora');
  await page.locator('.ProseMirror').click();
  await page.keyboard.type('The flagship project.', { delay: 10 });
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('file-page-back').click();
  await beat(page);

  // Note B — links to A with the [[ autocomplete.
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Index');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type('See ', { delay: 12 });
  await page.keyboard.type('[[Aur', { delay: 60 });

  // Autocomplete offers the existing note.
  const menu = page.getByTestId('wiki-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId('wiki-item').filter({ hasText: 'Aurora' })).toBeVisible();
  await beat(page, 500);
  await page.keyboard.press('Enter'); // accept → [[Aurora]]

  // Rendered as a wiki-link (the inner title, brackets dimmed).
  const link = editor.locator('.wiki-link').first();
  await expect(link).toBeVisible();
  await expect(link).toHaveText('Aurora');
  await page.keyboard.type(' for details.', { delay: 12 });
  await beat(page, 600);

  // Source shows literal [[Aurora]] — the graph stays intact.
  await page.getByTestId('file-page-source').click();
  await expect(page.locator('textarea').first()).toHaveValue(/\[\[Aurora\]\]/);
  await page.getByTestId('file-page-source').click();
  await beat(page, 500);

  // Clicking the link opens the target note.
  await editor.locator('.wiki-link').first().click();
  await expect(page.getByLabel('Note title')).toHaveValue('Aurora', { timeout: 10000 });
  await beat(page, 900);
});

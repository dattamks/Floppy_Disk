import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Obsidian-parity pass 4b: foldable headings. Hovering a heading reveals a
// chevron in the gutter; clicking it collapses the section (everything down to
// the next same-or-higher heading), clicking again expands it. The document is
// unchanged — folded blocks are only hidden.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 450) => page.waitForTimeout(ms);

async function slash(page, q, pick) {
  await page.keyboard.type('/' + q, { delay: 18 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.getByTestId('slash-item').filter({ hasText: pick }).click();
}

test('fold and unfold a heading section', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Folding');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await beat(page);

  await slash(page, 'h2', 'Heading 2');
  await page.keyboard.type('Setup', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('First install the dependencies.', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Then run the dev server.', { delay: 6 });
  await page.keyboard.press('Enter');
  await slash(page, 'h2', 'Heading 2');
  await page.keyboard.type('Deploy', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ship it to production.', { delay: 6 });
  await beat(page, 500);

  const setupPara = editor.getByText('First install the dependencies.');
  const deployPara = editor.getByText('Ship it to production.');
  await expect(setupPara).toBeVisible();

  // Hover the "Setup" heading → chevron appears; click it → the two Setup
  // paragraphs hide, but "Deploy" (a sibling h2) and its body stay visible.
  const setupHeading = editor.getByRole('heading', { name: 'Setup' });
  await setupHeading.hover();
  await beat(page, 400);
  await setupHeading.locator('.nd-fold-toggle').dispatchEvent('mousedown');
  await beat(page, 500);
  await expect(setupPara).toBeHidden();
  await expect(editor.getByText('Then run the dev server.')).toBeHidden();
  await expect(deployPara).toBeVisible();
  await expect(setupHeading).toBeVisible();
  await beat(page, 900);

  // Click again → the section expands.
  await setupHeading.hover();
  await setupHeading.locator('.nd-fold-toggle').dispatchEvent('mousedown');
  await beat(page, 500);
  await expect(setupPara).toBeVisible();
  await beat(page, 900);
});

import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Recorded walkthrough of the new note experience: no modal — a note opens
// full-page as a single clean writing surface (Notion/Obsidian feel), with a
// slash menu and an editable Source toggle. Saves as Markdown (graph-safe).
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 650) => page.waitForTimeout(ms);

test('Note experience walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);

  // New note opens full-page in the content area — no modal.
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await expect(page.getByLabel('Note title')).toBeVisible({ timeout: 10000 });
  await beat(page);
  await page.getByLabel('Note title').fill('Weekly review');
  await beat(page, 500);

  const editor = page.locator('.ProseMirror');
  await editor.click();

  // Heading via slash.
  await page.keyboard.type('/', { delay: 40 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 700);
  await page.keyboard.type('head', { delay: 55 });
  await beat(page, 600);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Wins', { delay: 25 });
  await page.keyboard.press('Enter');

  // Markdown shortcut: "- " starts a bullet list (the text already looks like a list).
  await page.keyboard.type('- Shipped the gallery', { delay: 18 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Wired the two sidebars', { delay: 18 });
  await beat(page, 600);

  // A to-do list via slash.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/todo', { delay: 45 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.getByTestId('slash-item').filter({ hasText: 'To-do list' }).click();
  await page.keyboard.type('Write the calendar plan', { delay: 18 });
  await beat(page, 800);

  // Toggle to editable Source (raw Markdown) and back — the writing is the doc.
  await page.getByTestId('file-page-source').click();
  await beat(page, 1200);
  await page.getByTestId('file-page-source').click();
  await beat(page, 700);

  // Save.
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await beat(page, 900);
});

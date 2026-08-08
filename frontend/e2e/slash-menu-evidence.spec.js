import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Recorded walkthrough of the minimal Notion-style slash menu in the note editor.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 650) => page.waitForTimeout(ms);

test('Slash-menu walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByLabel('Note title')).toBeVisible({ timeout: 10000 });
  await page.getByLabel('Note title').fill('Sprint plan');
  const editor = page.locator('.ProseMirror');
  await editor.waitFor({ timeout: 15000 });
  await editor.click();
  await beat(page);

  // Heading via slash.
  await page.keyboard.type('/', { delay: 40 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 900);
  await page.keyboard.type('head', { delay: 60 });
  await beat(page, 800);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Goals for the week', { delay: 25 });
  await beat(page, 700);

  // To-do list via slash (mouse pick).
  await page.keyboard.press('Enter');
  await page.keyboard.type('/todo', { delay: 55 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 800);
  await page.getByTestId('slash-item').filter({ hasText: 'To-do list' }).click();
  await page.keyboard.type('Ship the gallery', { delay: 20 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Wire the sidebars', { delay: 20 });
  await beat(page, 700);

  // Quote via slash.
  await page.keyboard.press('Enter');
  await page.keyboard.type('/quote', { delay: 55 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 700);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Keep it simple.', { delay: 25 });
  await beat(page, 900);

  // Show the arrow-key navigation of the menu, then Escape.
  await page.keyboard.press('Enter');
  await page.keyboard.type('/', { delay: 40 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 600);
  await page.keyboard.press('ArrowDown'); await beat(page, 350);
  await page.keyboard.press('ArrowDown'); await beat(page, 350);
  await page.keyboard.press('ArrowDown'); await beat(page, 350);
  await page.keyboard.press('Escape');
  await beat(page, 900);
});

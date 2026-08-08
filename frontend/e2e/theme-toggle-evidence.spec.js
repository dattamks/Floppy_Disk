import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// App-wide dark mode: the header toggle flips the whole UI, the choice persists
// across reloads (localStorage), and a note reads cleanly in dark.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 500) => page.waitForTimeout(ms);
const themeAttr = (page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));

test('dark mode toggles, persists, and themes a note', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);

  // A note to show the surface in both themes.
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Theme test');
  await page.locator('.ProseMirror').click();
  await page.keyboard.type('Reads well in the dark.', { delay: 6 });
  await beat(page, 500);

  // Toggle to dark.
  await page.getByLabel('Toggle theme').click();
  await expect.poll(() => themeAttr(page)).toBe('dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Dark background is much darker than the light appBg.
  const nums = bg.match(/\d+/g).map(Number);
  expect(nums[0] + nums[1] + nums[2]).toBeLessThan(180);
  await beat(page, 900);

  // Persist across reload.
  await page.reload();
  await expect.poll(() => themeAttr(page)).toBe('dark');
  await beat(page, 700);

  // Toggle back to light.
  await page.getByLabel('Toggle theme').click();
  await expect.poll(() => themeAttr(page)).toBe('light');
  await beat(page, 800);
});

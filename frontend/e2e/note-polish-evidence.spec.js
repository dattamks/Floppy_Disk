import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Verifies the post-audit polish fixes:
//  1. The selection bubble menu is visible (not white-on-white) in dark mode.
//  2. Dollar amounts in prose survive save→reopen as text, not KaTeX math.
test.use({ viewport: { width: 1280, height: 860 } });
const beat = (page, ms = 300) => page.waitForTimeout(ms);

test('dark bubble menu is visible + $ amounts stay prose', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Polish checks');
  const ed = page.locator('.ProseMirror');
  await ed.click();

  // Currency prose — the classic false-positive for inline $…$ math.
  await page.keyboard.type('The item is $5, shipping is $10 total.', { delay: 6 });
  await beat(page);
  // No math node should have formed while typing.
  await expect(ed.locator('.note-math-inline')).toHaveCount(0);

  // Selection bubble menu appears and its dark pill is distinguishable from the
  // charcoal canvas (regression guard for the theme.ink white-on-white bug).
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  const bubble = page.getByTestId('note-bubble');
  await expect(bubble).toBeVisible();
  const bg = await bubble.evaluate((el) => getComputedStyle(el).backgroundColor);
  // Not near-white: the sum of RGB channels on the dark pill is well below white.
  const sum = (bg.match(/\d+/g) || []).slice(0, 3).reduce((a, b) => a + +b, 0);
  expect(sum).toBeLessThan(500); // white would be 765
  await page.screenshot({ path: 'e2e/exports/dark-bubble.png' });

  // Collapse the selection, then save + round-trip.
  await page.keyboard.press('End');
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await page.reload();
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) await page.getByTestId('setup-skip').click();
  await page.getByText('Polish checks', { exact: false }).first().click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  // After reload the Markdown is re-parsed: still prose, still both amounts, no math.
  await expect(ed).toContainText('$5');
  await expect(ed).toContainText('$10');
  await expect(ed.locator('.note-math-inline')).toHaveCount(0);
});

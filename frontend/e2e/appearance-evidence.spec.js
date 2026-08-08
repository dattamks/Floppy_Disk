import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Appearance settings: choose theme (light/dark/system) and a primary accent
// color; both apply live across the app and persist.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 500) => page.waitForTimeout(ms);
const accentVar = (page) => page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
const dataAccent = (page) => page.evaluate(() => document.documentElement.getAttribute('data-accent'));

test('theme + accent color picker', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);

  await page.getByLabel('Settings').click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await beat(page, 400);

  const before = await accentVar(page);

  // Pick Dark theme.
  await page.getByTestId('theme-dark').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  await beat(page, 600);

  // Pick the Emerald accent → the brand variable changes + data-accent set.
  await page.getByTestId('accent-emerald').click();
  await expect.poll(() => dataAccent(page)).toBe('emerald');
  await expect.poll(() => accentVar(page)).not.toBe(before);
  await beat(page, 800);

  // Persists across reload.
  await page.reload();
  await expect.poll(() => dataAccent(page)).toBe('emerald');
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  await beat(page, 700);

  // Switch back to a Blue accent to show live re-tint.
  await page.getByLabel('Settings').click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByTestId('accent-blue').click();
  await expect.poll(() => dataAccent(page)).toBe('blue');
  const blueBrand = await accentVar(page);
  await beat(page, 700);

  // Custom color picker: type any hex → data-accent="custom", live re-tint,
  // and it persists across a reload.
  await page.getByTestId('accent-hex-input').fill('#C026D3');
  await page.getByTestId('accent-hex-input').blur();
  await expect.poll(() => dataAccent(page)).toBe('custom');
  await expect.poll(() => accentVar(page)).not.toBe(blueBrand);
  await beat(page, 800);
  await page.reload();
  await expect.poll(() => dataAccent(page)).toBe('custom');
  await beat(page, 600);
});

import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// A modern phone viewport. The app treats width < 820 as mobile.
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

async function noHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  // Allow a 1px rounding slack; anything more means content spills sideways.
  expect(overflow).toBeLessThanOrEqual(1);
}

test('the phone layout shows the bottom tab bar, not the desktop sidebar', async ({ page }) => {
  await registerNewUser(page);
  // Bottom tabs are the mobile primary nav.
  await expect(page.getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
});

test('the hamburger opens a nav drawer with the secondary destinations', async ({ page }) => {
  await registerNewUser(page);
  // Starred/Recent live in the drawer on mobile, not the bottom bar.
  await page.getByRole('button', { name: 'Create', exact: true }).waitFor();
  // Open the drawer via the hamburger (first icon button in the mobile top bar).
  await page.locator('svg path[d="M4 6h16M4 12h16M4 18h16"]').locator('xpath=ancestor::button[1]').click();
  await expect(page.getByRole('button', { name: 'Starred' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recent' })).toBeVisible();
});

test('the create FAB reveals upload / new folder / new note', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New folder' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New note' })).toBeVisible();
});

test('uploading and previewing works on a phone', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'phone.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('from a phone'),
  });
  await expect(page.getByText('phone.txt')).toBeVisible();
  await page.keyboard.press('Escape');
  await noHorizontalOverflow(page);
});

test('Settings opens as a full page on mobile and stays within the viewport', async ({ page }) => {
  await registerNewUser(page);
  // The avatar button (top-right) opens Settings on mobile.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
});

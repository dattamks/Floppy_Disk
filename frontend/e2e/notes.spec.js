import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// End-to-end for the note-taking flow: create, edit, save, backlinks, move, delete.
test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('create, edit, save, and reopen a note', async ({ page }) => {
  await registerNewUser(page);

  // New note → editor opens.
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByLabel('Note title')).toBeVisible({ timeout: 10000 });

  // Title + body, with a live preview beside the editor.
  await page.getByLabel('Note title').fill('Meeting notes');
  const body = page.locator('textarea').first();
  await body.fill('# Standup\nShip the **photon** pipeline.');
  await expect(page.getByText('Standup', { exact: false })).toBeVisible(); // live preview
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  // The note now exists in the drive under its title.
  await expect(page.getByText('Meeting notes.md', { exact: false }).first()).toBeVisible({ timeout: 10000 });

  // Reopen → content persisted (rendered).
  await page.getByText('Meeting notes.md', { exact: false }).first().click();
  await expect(page.getByText('Standup', { exact: false })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  // Full-text search finds it by a word only in the body.
  await page.getByPlaceholder('Search files and folders').fill('photon');
  await expect(page.getByText('Meeting notes.md', { exact: false }).first()).toBeVisible({ timeout: 10000 });
});

test('notes link to each other (backlinks)', async ({ page }) => {
  await registerNewUser(page);

  // Note A.
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByLabel('Note title').fill('Aurora');
  await page.locator('textarea').first().fill('# Aurora\nThe flagship.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await page.keyboard.press('Escape');

  // Note B links to A via a wiki-link.
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByLabel('Note title').fill('Index');
  await page.locator('textarea').first().fill('See [[Aurora]] for details.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await page.keyboard.press('Escape');

  // Open A → it shows a "Linked mentions" backlink to Index.
  await page.getByText('Aurora.md', { exact: false }).first().click();
  await expect(page.getByText('Linked mentions')).toBeVisible({ timeout: 15000 });
});

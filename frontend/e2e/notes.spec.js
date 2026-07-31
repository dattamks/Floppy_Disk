import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// End-to-end for the note-taking flow with the WYSIWYG editor + Write/Markdown/
// Preview tabs: create, rich-text edit, save, backlinks.
test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

// Enter note body via the raw "Markdown" tab (deterministic), then return to Write.
async function setBodyViaMarkdown(page, text) {
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await page.locator('textarea').first().fill(text);
}

test('create a note in the WYSIWYG editor and save it', async ({ page }) => {
  await registerNewUser(page);

  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByLabel('Note title')).toBeVisible({ timeout: 10000 });
  await page.getByLabel('Note title').fill('Meeting notes');

  // WYSIWYG: type into the rich-text surface and apply bold via the toolbar.
  const editor = page.locator('.ProseMirror');
  await editor.waitFor({ timeout: 15000 }); // lazy-loaded editor chunk
  await editor.click();
  await page.getByTitle('Heading 1').click();
  await editor.pressSequentially('Standup', { delay: 15 });
  await page.keyboard.press('Enter');
  await editor.pressSequentially('Ship the photon pipeline.', { delay: 10 });
  // The heading is visible as formatted text (no raw '#').
  await expect(page.getByRole('heading', { name: 'Standup' })).toBeVisible();

  // Markdown tab shows the generated source.
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(page.locator('textarea').first()).toHaveValue(/# Standup/);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  await expect(page.getByText('Meeting notes.md', { exact: false }).first()).toBeVisible({ timeout: 10000 });

  // Full-text search finds it by a word only in the body.
  await page.getByPlaceholder('Search files and folders').fill('photon');
  await expect(page.getByText('Meeting notes.md', { exact: false }).first()).toBeVisible({ timeout: 10000 });
});

test('notes link to each other (backlinks)', async ({ page }) => {
  await registerNewUser(page);

  // Note A.
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByLabel('Note title').fill('Aurora');
  await page.locator('.ProseMirror').waitFor({ timeout: 15000 });
  await setBodyViaMarkdown(page, '# Aurora\nThe flagship.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await page.keyboard.press('Escape');

  // Note B links to A via a wiki-link.
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByLabel('Note title').fill('Index');
  await page.locator('.ProseMirror').waitFor({ timeout: 15000 });
  await setBodyViaMarkdown(page, 'See [[Aurora]] for details.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await page.keyboard.press('Escape');

  // Open A → it shows a "Linked mentions" backlink to Index.
  await page.getByText('Aurora.md', { exact: false }).first().click();
  await expect(page.getByText('Linked mentions')).toBeVisible({ timeout: 15000 });
});

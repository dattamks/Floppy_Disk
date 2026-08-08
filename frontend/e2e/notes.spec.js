import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// End-to-end for the note-taking flow with the WYSIWYG editor + Write/Markdown/
// Preview tabs: create, rich-text edit, save, backlinks.
test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

// Enter note body via the raw "Source" toggle (deterministic).
async function setBodyViaMarkdown(page, text) {
  await page.getByTestId('file-page-source').click();
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
  await page.keyboard.type('/head'); // slash menu (toolbar removed)
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.keyboard.press('Enter'); // Heading 1
  await editor.pressSequentially('Standup', { delay: 15 });
  await page.keyboard.press('Enter');
  await editor.pressSequentially('Ship the photon pipeline.', { delay: 10 });
  // The heading is visible as formatted text (no raw '#').
  await expect(page.getByRole('heading', { name: 'Standup' })).toBeVisible();

  // Markdown tab shows the generated source.
  await page.getByTestId('file-page-source').click();
  await expect(page.locator('textarea').first()).toHaveValue(/# Standup/);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('file-page-back').click();

  await expect(page.getByText('Meeting notes.md', { exact: false }).first()).toBeVisible({ timeout: 10000 });

  // Full-text search finds it by a word only in the body.
  await page.getByPlaceholder('Search files and folders').fill('photon');
  await expect(page.getByText('Meeting notes.md', { exact: false }).first()).toBeVisible({ timeout: 10000 });
});

test('code marks a selection inline and never turns the whole note into code', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  const editor = page.locator('.ProseMirror');
  await editor.waitFor({ timeout: 15000 });

  // 1) Inline code via the Markdown backtick input rule (toolbar is gone) wraps
  // only the delimited word - not the whole block.
  await editor.click();
  await editor.pressSequentially('run the `command`', { delay: 15 });
  await expect(editor.locator('p code')).toHaveText('command');
  await expect(editor.locator('p')).toContainText('run the'); // rest of the line intact

  // 2) Code block via the slash menu is inserted as a fresh (empty) block and
  // never swallows the note's existing text.
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter'); // new empty paragraph
  await page.keyboard.type('/code');
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.getByTestId('slash-item').filter({ hasText: 'Code block' }).click();
  await expect(editor.getByText('run the')).toBeVisible(); // original text preserved
  await expect(editor.locator('pre')).toBeVisible(); // an (empty) code block was added
  await expect(editor.locator('pre')).toHaveText(''); // it did not absorb the text
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
  await page.getByTestId('file-page-back').click();

  // Note B links to A via a wiki-link.
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByLabel('Note title').fill('Index');
  await page.locator('.ProseMirror').waitFor({ timeout: 15000 });
  await setBodyViaMarkdown(page, 'See [[Aurora]] for details.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await page.getByTestId('file-page-back').click();

  // Open A → it shows a "Linked mentions" backlink to Index.
  await page.getByText('Aurora.md', { exact: false }).first().click();
  await expect(page.getByText('Linked mentions')).toBeVisible({ timeout: 15000 });
});

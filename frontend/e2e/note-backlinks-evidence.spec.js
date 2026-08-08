import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Obsidian-parity pass 3: the backlinks panel. Opening a note shows "Linked
// mentions" (notes that [[link]] it) and "Unlinked mentions" (notes that name
// it in prose), each source collapsible with an in-context snippet where the
// mention is highlighted. Count badges on each section.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 500) => page.waitForTimeout(ms);

async function newNote(page, title, body) {
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill(title);
  await page.getByTestId('file-page-source').click();
  await page.locator('textarea').first().fill(body);
  await page.getByTestId('file-page-source').click();
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await beat(page, 300);
  await page.getByTestId('file-page-back').click();
  await beat(page, 300);
}

test('backlinks: linked + unlinked mentions with context', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);

  await newNote(page, 'Aurora', '# Aurora\nThe flagship project of record.');
  await newNote(page, 'Roadmap', 'The plan references [[Aurora]] as the north star for Q3.');
  await newNote(page, 'Standup', 'We talked about [[Aurora]] and shipping dates.');
  await newNote(page, 'Diary', 'Today I finally understood what Aurora is really about.');

  // Open Aurora → the backlinks panel shows both sections with context.
  await page.getByText('Aurora.md', { exact: false }).first().click();
  await expect(page.getByTestId('file-page')).toBeVisible();

  await expect(page.getByText('Linked mentions', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Unlinked mentions', { exact: true })).toBeVisible();
  // Both linking notes appear as sources.
  await expect(page.locator('.bl-src', { hasText: 'Roadmap' })).toBeVisible();
  await expect(page.locator('.bl-src', { hasText: 'Standup' })).toBeVisible();
  await expect(page.locator('.bl-src', { hasText: 'Diary' })).toBeVisible();
  // The linked snippet highlights the [[Aurora]]; the unlinked one highlights "Aurora".
  await expect(page.locator('.bl-hit', { hasText: '[[Aurora]]' }).first()).toBeVisible();
  await expect(page.locator('.bl-hit-plain', { hasText: 'Aurora' }).first()).toBeVisible();
  await expect(page.locator('.bl-snip', { hasText: 'north star' }).first()).toBeVisible();

  // Scroll the panel into view for the recording.
  await page.locator('.bl-wrap').scrollIntoViewIfNeeded();
  await beat(page, 1200);

  // Clicking a source opens it.
  await page.locator('.bl-src', { hasText: 'Roadmap' }).getByRole('link').click();
  await expect(page.getByLabel('Note title')).toHaveValue('Roadmap', { timeout: 10000 });
  await beat(page, 900);
});

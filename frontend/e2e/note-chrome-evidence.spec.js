import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Obsidian-parity pass 4a: reading chrome — a live word/character/backlink
// status bar, an "On this page" outline that jumps to headings, and the
// filename breadcrumb in the header.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 450) => page.waitForTimeout(ms);

async function slash(page, q, pick) {
  await page.keyboard.type('/' + q, { delay: 20 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.getByTestId('slash-item').filter({ hasText: pick }).click();
}

test('outline + status bar', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Handbook');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await beat(page);

  // Several sections so the outline is meaningful.
  for (const [h, title, body] of [
    ['h1', 'Overview', 'A short introduction to the handbook.'],
    ['h2', 'Setup', 'How to get the environment running locally.'],
    ['h2', 'Workflow', 'The day-to-day loop we follow.'],
    ['h2', 'Release', 'How changes ship to production.'],
  ]) {
    await slash(page, h, h === 'h1' ? 'Heading 1' : 'Heading 2');
    await page.keyboard.type(title, { delay: 8 });
    await page.keyboard.press('Enter');
    await page.keyboard.type(body, { delay: 4 });
    await page.keyboard.press('Enter');
  }
  await beat(page, 500);

  // Status bar shows live counts.
  const status = page.getByTestId('note-statusbar');
  await expect(status).toBeVisible();
  await expect(status).toContainText('words');
  await expect(status).toContainText('characters');

  // Outline lists the headings; clicking one jumps to it.
  const outline = page.getByTestId('note-outline');
  await expect(outline).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Overview' })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Release' })).toBeVisible();
  await beat(page, 600);
  await outline.getByRole('button', { name: 'Release' }).click();
  await beat(page, 900);
  await expect(editor.getByRole('heading', { name: 'Release' })).toBeInViewport();
  await beat(page, 900);
});

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { blockExternal, registerNewUser } from './helpers.js';

// A note can be exported as Markdown (raw), HTML (rendered + styled), or PDF
// (a print-optimized window). Markdown and HTML download directly.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 450) => page.waitForTimeout(ms);

test('export note as markdown / html / pdf', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Export me');
  const ed = page.locator('.ProseMirror');
  await ed.click();
  await page.keyboard.type('# Overview', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('The exportable body text.', { delay: 6 });
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await beat(page, 400);

  // Open the export menu.
  await page.getByTestId('note-export').click();
  const menu = page.getByTestId('note-export-menu');
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('note-export-md')).toBeVisible();
  await expect(page.getByTestId('note-export-html')).toBeVisible();
  await expect(page.getByTestId('note-export-pdf')).toBeVisible();
  await beat(page, 500);

  // Markdown export downloads the raw note.
  const [mdDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('note-export-md').click(),
  ]);
  expect(mdDl.suggestedFilename()).toBe('Export me.md');
  const mdText = readFileSync(await mdDl.path(), 'utf8');
  expect(mdText).toContain('# Overview');
  expect(mdText).toContain('The exportable body text.');
  await beat(page, 500);

  // HTML export downloads a styled document.
  await page.getByTestId('note-export').click();
  const [htmlDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('note-export-html').click(),
  ]);
  expect(htmlDl.suggestedFilename()).toBe('Export me.html');
  const html = readFileSync(await htmlDl.path(), 'utf8');
  expect(html).toContain('<!doctype html>');
  expect(html).toContain('The exportable body text.');
  expect(html).toMatch(/<h1[^>]*>Overview<\/h1>/);
  await beat(page, 700);
});

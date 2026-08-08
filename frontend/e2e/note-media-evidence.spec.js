import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Notes can embed real uploads: /image uploads a picture inline, and /file
// uploads any file and drops in a clickable attachment chip. Both land in the
// library too (stored, counted, shown in the grid/gallery).
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 500) => page.waitForTimeout(ms);
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082', 'hex');

async function slash(page, q, pick) {
  await page.keyboard.type('/' + q, { delay: 20 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 200);
  await page.getByTestId('slash-item').filter({ hasText: pick }).click();
}

test('note image upload + file attachment', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Trip notes');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await beat(page, 300);

  await page.keyboard.type('Here is the cover photo:', { delay: 8 });
  await page.keyboard.press('Enter');

  // Inline image via /image → picker → upload.
  await slash(page, 'image', 'Image');
  await page.setInputFiles('[data-testid="note-file-input"]', { name: 'cover.png', mimeType: 'image/png', buffer: PNG });
  const img = editor.locator('img');
  await expect(img).toBeVisible({ timeout: 10000 });
  await expect(img).toHaveAttribute('src', /\/storage\/files\/.+\/raw/);
  await beat(page, 600);

  // A file attachment via /file → picker → chip.
  await page.keyboard.press('Enter');
  await page.keyboard.type('And the itinerary:', { delay: 8 });
  await page.keyboard.press('Enter');
  await slash(page, 'file', 'File attachment');
  await page.setInputFiles('[data-testid="note-file-input"]', { name: 'itinerary.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 trip') });
  const chip = editor.locator('a[href*="/raw"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await expect(chip).toContainText('itinerary.pdf');
  await beat(page, 700);

  // Both were stored: the source view keeps a real Markdown image + link.
  await page.getByTestId('file-page-source').click();
  const raw = await page.locator('textarea').first().inputValue();
  expect(raw).toMatch(/!\[[^\]]*\]\(.+\/raw\)/);   // markdown image
  expect(raw).toMatch(/\[[^\]]*itinerary\.pdf\]\(.+\/raw\)/); // attachment link
  await beat(page, 700);
});

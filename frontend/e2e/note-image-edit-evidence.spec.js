import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { blockExternal, registerNewUser } from './helpers.js';

// An image in a note can be resized (drag handle), aligned, and captioned. All
// three persist through save → source → reload, and a plain image stays clean
// `![](…)` Markdown until one of them is used.
test.use({ video: { mode: 'on', size: { width: 1360, height: 900 } }, viewport: { width: 1360, height: 900 } });
const beat = (page, ms = 450) => page.waitForTimeout(ms);
const PNG = readFileSync(path.resolve('e2e/fixtures/map.png'));

test('image resize + align + caption round-trip', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Image editing');
  const ed = page.locator('.ProseMirror');
  await ed.click();

  // Insert an image via /image.
  await page.keyboard.type('/image', { delay: 14 });
  await page.getByTestId('slash-item').filter({ hasText: /^Image$/ }).first().click();
  await page.setInputFiles('[data-testid="note-file-input"]', { name: 'map.png', mimeType: 'image/png', buffer: PNG });
  const img = ed.locator('.note-figure img');
  await expect(img).toBeVisible({ timeout: 10000 });
  await beat(page, 500);

  // Select the image → the image toolbar + resize handle appear.
  await img.click();
  await expect(page.getByTestId('note-image-align-center')).toBeVisible();
  await beat(page, 300);

  // Resize: drag the handle left to shrink the image.
  const handle = page.getByTestId('note-image-resize');
  const b = await handle.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x - 140, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
  await beat(page, 400);

  // Align center.
  await img.click();
  await page.getByTestId('note-image-align-center').click();
  await beat(page, 300);

  // Add a caption.
  await img.click();
  await page.getByTestId('note-image-caption-toggle').click();
  await page.getByTestId('note-image-caption').fill('The coastal map');
  await beat(page, 400);

  // Save + inspect the persisted Markdown.
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('file-page-source').click();
  const raw = await page.locator('textarea').first().inputValue();
  expect(raw).toMatch(/<img[^>]*\bdata-align="center"/);
  expect(raw).toMatch(/<img[^>]*\bwidth="\d+"/);
  expect(raw).toContain('data-caption="The coastal map"');
  await page.getByTestId('file-page-source').click();
  await beat(page, 300);

  // Reload + reopen: the resized, aligned, captioned image survives.
  await page.reload();
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); }
  await page.getByText('Image editing', { exact: false }).first().click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await expect(page.locator('.ProseMirror .note-figure img')).toBeVisible({ timeout: 10000 });
  // The width + alignment survived (they render on the figure/img).
  await expect(page.locator('.ProseMirror .note-figure[data-align="center"]')).toBeVisible();
  await expect(page.locator('.ProseMirror .note-figure img')).toHaveAttribute('style', /width:\s*273px/);
  // Caption survived: selecting the image shows it in the caption editor.
  await page.locator('.ProseMirror .note-figure img').click();
  await expect(page.getByTestId('note-image-caption')).toHaveValue('The coastal map', { timeout: 10000 });
  await beat(page, 500);
});

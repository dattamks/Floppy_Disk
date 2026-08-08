import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Recorded walkthrough: documents open full-page in the content area (not a
// modal) — review, then edit in place; Back returns to the grid.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 700) => page.waitForTimeout(ms);

async function upload(page, name, mime, text) {
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: mime, buffer: Buffer.from(text) });
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
}

test('Full-page file view walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);

  await upload(page, 'roadmap.md', 'text/markdown', '# Roadmap\n\n- Ship the full-page viewer\n- **Edit** right in the content area\n');
  await upload(page, 'config.json', 'application/json', '{"name":"floppy","features":["gallery","tables","notes"],"public":true}');

  const page4 = page.getByTestId('file-page');

  // Open the markdown doc full-page (review).
  await page.getByText('roadmap.md', { exact: true }).first().click();
  await expect(page4).toBeVisible();
  await expect(page4.getByRole('heading', { name: 'Roadmap' })).toBeVisible();
  await beat(page, 1100);

  // A note opens straight into the clean writing surface — type a new line.
  await page4.locator('.ProseMirror').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Land it', { delay: 25 });
  await beat(page, 700);
  // Peek at the editable Source (raw Markdown), then Save.
  await page4.getByTestId('file-page-source').click();
  await beat(page, 900);
  await page4.getByTestId('file-page-source').click();
  await page4.getByTestId('file-page-save').click();
  await beat(page, 900);

  // Back to the grid, then open the JSON — pretty-printed + highlighted, full-page.
  await page.getByTestId('file-page-back').click();
  await beat(page, 500);
  await page.getByText('config.json', { exact: true }).first().click();
  await expect(page4.locator('pre.code-hl')).toBeVisible();
  await beat(page, 1300);
  await page.getByTestId('file-page-back').click();
  await beat(page, 500);
});

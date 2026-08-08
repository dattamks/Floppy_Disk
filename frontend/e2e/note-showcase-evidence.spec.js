import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// One sample note showing the look: no toolbar; headings, a paragraph, a
// checklist (with a checked item), alignments, an image, and a filled table —
// all on the clean full-page writing surface.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 450) => page.waitForTimeout(ms);

async function slash(page, q, pick) {
  await page.keyboard.type('/' + q, { delay: 25 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 220);
  await page.getByTestId('slash-item').filter({ hasText: pick }).click();
}

test('Note showcase', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Team notes');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await beat(page);

  // Headings + paragraph.
  await slash(page, 'h1', 'Heading 1');
  await page.keyboard.type('Roadmap', { delay: 12 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Everything below lives in one clean note.', { delay: 6 });
  await page.keyboard.press('Enter');

  // Checklist with a checked item.
  await slash(page, 'todo', 'To-do list');
  await page.keyboard.type('Ship the gallery', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Wire the two sidebars', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Write the calendar plan', { delay: 10 });
  await page.keyboard.press('Enter'); // empty item…
  await page.keyboard.press('Enter'); // …exits the list
  await editor.locator('input[type="checkbox"]').first().check();
  await beat(page, 500);

  // Alignments.
  await slash(page, 'center', 'Align center');
  await page.keyboard.type('A centered line.', { delay: 8 });
  await page.keyboard.press('Enter');
  await slash(page, 'right', 'Align right');
  await page.keyboard.type('A right-aligned line.', { delay: 8 });
  await page.keyboard.press('Enter');
  await slash(page, 'left', 'Align left');

  // Image — /image opens the picker; upload a real (tiny) PNG.
  await slash(page, 'image', 'Image');
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082', 'hex');
  await page.setInputFiles('[data-testid="note-file-input"]', { name: 'shot.png', mimeType: 'image/png', buffer: PNG });
  await expect(editor.locator('img')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Enter');

  // A filled table.
  await slash(page, 'h2', 'Heading 2');
  await page.keyboard.type('Status table', { delay: 10 });
  await page.keyboard.press('Enter');
  await slash(page, 'table', 'Table');
  for (const cell of ['Area', 'Status', 'Owner', 'Gallery', 'Done', 'Datta', 'Notes', 'In progress', 'Team']) {
    await page.keyboard.type(cell, { delay: 8 });
    await page.keyboard.press('Tab');
  }
  await beat(page, 800);

  // Everything rendered.
  await expect(editor.getByRole('heading', { name: 'Roadmap' })).toBeVisible();
  await expect(editor.locator('input[type="checkbox"]:checked')).toHaveCount(1);
  await expect(editor.locator('img')).toBeVisible();
  await expect(editor.locator('table')).toContainText('Gallery');
  await expect(editor.locator('table')).toContainText('In progress');

  // Slowly pan the whole note so every element is visible in the recording.
  await page.mouse.move(680, 430);
  await page.keyboard.press('Control+Home');
  await beat(page, 900);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 190);
    await beat(page, 420);
  }
  await beat(page, 1000);
});

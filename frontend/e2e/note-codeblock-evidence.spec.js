import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Obsidian-parity pass 1: roomier typography + a real code block — rounded
// panel, corner language label (a picker), syntax highlighting, and a copy
// button. Plus a refined inline-code pill and a blockquote.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 500) => page.waitForTimeout(ms);

async function slash(page, q, pick) {
  await page.keyboard.type('/' + q, { delay: 25 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 220);
  await page.getByTestId('slash-item').filter({ hasText: pick }).click();
}

test('code block + typography', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Setup playbook');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await beat(page);

  // Heading + intro paragraph with an inline-code pill.
  await slash(page, 'h1', 'Heading 1');
  await page.keyboard.type('Second brain setup', { delay: 12 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Clone the repo, then run `make dev` to boot everything.', { delay: 6 });
  await page.keyboard.press('Enter');
  await expect(editor.locator('p code')).toHaveText('make dev');

  // A quote.
  await slash(page, 'quote', 'Quote');
  await page.keyboard.type('Notes are the substrate; links are the structure.', { delay: 8 });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // leave the quote

  // A code block via slash, pick a language, type code → syntax highlighting.
  await slash(page, 'h2', 'Heading 2');
  await page.keyboard.type('First run', { delay: 10 });
  await page.keyboard.press('Enter');
  await slash(page, 'code', 'Code block');
  const cb = editor.locator('.note-codeblock');
  await expect(cb).toBeVisible();
  await cb.locator('select').selectOption('bash');
  await page.keyboard.type('# start the dev stack\ngit clone repo && cd repo\nmake dev  # http://localhost:5173\n', { delay: 12 });
  await beat(page, 600);

  // Highlighting is live: lowlight emits hljs token spans.
  await expect(cb.locator('code .hljs-comment').first()).toBeVisible();
  // The language picker shows the chosen language.
  await expect(cb.locator('select')).toHaveValue('bash');

  // Copy button copies and confirms.
  await cb.getByRole('button', { name: 'Copy code' }).click();
  await expect(cb.getByText('Copied')).toBeVisible();
  await beat(page, 900);

  // Pan the whole note for the recording.
  await page.keyboard.press('Control+Home');
  await beat(page, 700);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 170); await beat(page, 380); }
  await beat(page, 900);
});

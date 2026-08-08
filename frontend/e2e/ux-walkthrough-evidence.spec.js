import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// A from-the-beginning UX flow: sign up → note experience → theming (dark +
// accent) → the main areas. Premium light matte-paper and dark matte-black.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 550) => page.waitForTimeout(ms);

async function slash(page, q, pick) {
  await page.keyboard.type('/' + q, { delay: 20 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 200);
  await page.getByTestId('slash-item').filter({ hasText: pick }).click();
}

test('UX walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page); // sign up from the beginning
  await beat(page, 700);

  // A note that shows the Obsidian-grade writing surface.
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Second brain');
  const ed = page.locator('.ProseMirror');
  await ed.click();
  await beat(page, 300);
  await slash(page, 'h1', 'Heading 1');
  await page.keyboard.type('Overview', { delay: 12 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Boot it with `make dev`, then read the [[Roadmap]].', { delay: 8 });
  await page.keyboard.press('Enter');
  await slash(page, 'code', 'Code block');
  await ed.locator('.note-codeblock select').selectOption('bash').catch(() => {});
  await page.keyboard.type('git clone repo && cd repo  # start here\nmake dev', { delay: 8 });
  await beat(page, 700);
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await beat(page, 700);
  await page.getByTestId('file-page-back').click();
  await beat(page, 600);

  // Theming: Settings → Appearance → Dark + Emerald accent.
  await page.getByLabel('Settings').click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await beat(page, 700);
  await page.getByTestId('theme-dark').click();
  await beat(page, 800);
  await page.getByTestId('accent-emerald').click();
  await beat(page, 1000);

  // Back to files, now dark + emerald.
  await page.getByRole('button', { name: 'Back to files' }).click();
  await beat(page, 800);

  // Reopen the note in dark to show it reads beautifully.
  await page.getByText('Second brain.md', { exact: false }).first().click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await beat(page, 1200);
  await page.getByTestId('file-page-back').click();
  await beat(page, 600);

  // Tour Tables and Gallery.
  await page.getByTestId('nav-tables').click();
  await beat(page, 1000);
  await page.getByTestId('nav-gallery').click();
  await beat(page, 1000);
  await page.getByTestId('nav-all').click();
  await beat(page, 900);
});

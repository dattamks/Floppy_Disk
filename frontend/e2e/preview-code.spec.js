import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// The universal preview pane: source code opens syntax-highlighted, and JSON is
// pretty-printed (and highlighted) even when the stored bytes are minified.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function upload(page, name, mimeType, text) {
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer: Buffer.from(text) });
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
}

test('code files preview with syntax highlighting; JSON pretty-prints', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  await upload(page, 'app.js', 'text/javascript', 'const greet = "hi"; // wave\nfunction f() { return 42; }\n');
  await upload(page, 'data.json', 'application/json', '{"name":"floppy","n":3,"ok":true}');

  // Open the code file -> highlighted <pre class="code-hl"> with token spans.
  await page.getByText('app.js', { exact: true }).first().click();
  const dialog = page.getByTestId('file-page');
  const codePre = dialog.locator('pre.code-hl');
  await expect(codePre).toBeVisible();
  await expect(codePre.locator('.tok-kw').filter({ hasText: 'const' }).first()).toBeVisible();
  await expect(codePre.locator('.tok-str').filter({ hasText: '"hi"' }).first()).toBeVisible();
  await expect(codePre.locator('.tok-comment').filter({ hasText: '// wave' }).first()).toBeVisible();
  await expect(codePre.locator('.tok-num').filter({ hasText: '42' }).first()).toBeVisible();
  await page.getByTestId('file-page-back').click();

  // Open the JSON file -> pretty-printed (multi-line, indented) + key tokens.
  await page.getByText('data.json', { exact: true }).first().click();
  const jsonPre = dialog.locator('pre.code-hl');
  await expect(jsonPre).toBeVisible();
  await expect(jsonPre.locator('.tok-key').filter({ hasText: '"name"' }).first()).toBeVisible();
  // Stored bytes were minified; the pane pretty-prints them onto indented lines.
  const text = await jsonPre.innerText();
  expect(text).toContain('\n  "name"');
});

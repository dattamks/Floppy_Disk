import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Recorded, human-paced walkthrough of the universal preview pane for the demo.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });

const beat = (page, ms = 700) => page.waitForTimeout(ms);

const PY = `# fibonacci
def fib(n):
    a, b = 0, 1
    for i in range(n):
        a, b = b, a + b
    return a

print(fib(10))  # 55
`;
const JS = `const api = "https://floppy.disk";
function greet(name) {
  // wave hello
  return \`Hi \${name}!\`;
}
export default greet;
`;
const JSON_MIN = '{"name":"floppy","version":2,"tags":["files","notes","tables"],"public":true,"limit":null}';

async function upload(page, name, mimeType, text) {
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer: Buffer.from(text) });
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
}

test('Universal preview walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  await upload(page, 'fib.py', 'text/x-python', PY);
  await upload(page, 'greet.js', 'text/javascript', JS);
  await upload(page, 'manifest.json', 'application/json', JSON_MIN);
  await beat(page);

  // Python - syntax highlighted.
  await page.getByText('fib.py', { exact: true }).first().click();
  await expect(page.getByTestId('file-page').locator('pre.code-hl')).toBeVisible();
  await beat(page, 1400);
  await page.getByTestId('file-page-back').click(); await beat(page, 400);

  // JavaScript - keywords, strings, comments.
  await page.getByText('greet.js', { exact: true }).first().click();
  await expect(page.getByTestId('file-page').locator('pre.code-hl')).toBeVisible();
  await beat(page, 1400);
  await page.getByTestId('file-page-back').click(); await beat(page, 400);

  // JSON - minified bytes pretty-print onto indented, coloured lines.
  await page.getByText('manifest.json', { exact: true }).first().click();
  await expect(page.getByTestId('file-page').locator('pre.code-hl')).toBeVisible();
  await beat(page, 1600);
  await page.getByTestId('file-page-back').click(); await beat(page, 500);
});

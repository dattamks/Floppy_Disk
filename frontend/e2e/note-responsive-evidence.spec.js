import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

const MD = `# Polish audit

A paragraph with **bold**, *italic*, ==highlight==, \`code\`, a [[Wiki Note]] and inline math $E=mc^2$ in a sentence.

<div data-callout="info"><p>Info callout — related context.</p></div>
<div data-callout="success"><p>Success callout — it worked.</p></div>
<div data-callout="warning"><p>Warning callout — be careful.</p></div>
<div data-callout="danger"><p>Danger callout — stop.</p></div>
<div data-callout="note"><p>Note callout — a side note.</p></div>

## Math block

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

## Two columns

<div data-columns=""><div data-column=""><p>Left column with a point and some longer text that wraps onto another line to show flow.</p></div><div data-column=""><p>Right column, equally weighted, sitting beside the left one.</p></div></div>

## Code & table

\`\`\`js
const answer = 42;
\`\`\`

| Feature | State |
| --- | --- |
| Math | done |
| Columns | done |

> A blockquote for good measure.

- [x] shipped
- [ ] polish
`;

async function buildNote(page) {
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Polish audit');
  await page.getByTestId('file-page-source').click();
  await page.locator('textarea').first().fill(MD);
  await page.getByTestId('file-page-source').click(); // back to editor → parses everything
  await expect(page.locator('.ProseMirror .note-columns')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.ProseMirror .note-math-block math').first()).toBeVisible();
  await page.waitForTimeout(700);
}

const flexDir = (page) => page.locator('.ProseMirror .note-columns').first()
  .evaluate((el) => getComputedStyle(el).flexDirection);

test('desktop light + dark: columns are side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blockExternal(page);
  await registerNewUser(page);
  await buildNote(page);
  expect(await flexDir(page)).toBe('row');
  await page.screenshot({ path: 'e2e/exports/audit-desktop-light.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'e2e/exports/audit-desktop-dark.png', fullPage: true });
});

test('mobile: columns stack + no action is cut off', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blockExternal(page);
  await registerNewUser(page);
  await buildNote(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  // Columns stack vertically on a phone.
  expect(await flexDir(page)).toBe('column');
  // Save stays within the viewport (the header wraps instead of overflowing).
  const box = await page.getByTestId('file-page-save').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'e2e/exports/audit-mobile.png', fullPage: true });
});

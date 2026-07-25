import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockExternal(page); });

// EICAR standard anti-malware test signature (harmless).
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

test('an infected upload is blocked by the malware scan', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Upload' }).click();

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/uploads/') && r.url().includes('/complete')),
    page.locator('input[type="file"]').setInputFiles({
      name: 'virus.txt', mimeType: 'text/plain', buffer: Buffer.from(EICAR),
    }),
  ]);
  expect(resp.status()).toBe(422); // backend rejected it at the scan step

  // The blocked file never shows up in My Files.
  await expect(page.getByText('virus.txt')).toHaveCount(0);
});

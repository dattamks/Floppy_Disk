import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockExternal, registerNewUser, uniqueEmail } from './helpers.js';

// Owner-only self-service storage, as recorded proof. Named "00-" so it runs
// FIRST: the very first account to register becomes the instance Owner, which is
// exactly what the owner walkthrough needs. A later account (test 2) is never
// the owner, so the gating assertion is deterministic regardless.
//
// Video + screenshots land under test-results/owner-storage/.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'test-results', 'owner-storage');

test.use({ video: 'on' });

async function beat(page, ms = 500) {
  await page.waitForTimeout(ms);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: false });
}

test('Owner: first-run setup, ephemeral banner, and Storage settings (recorded)', async ({
  page,
}) => {
  test.setTimeout(120000);
  await blockExternal(page);

  await test.step('Register the first account — becomes the Owner', async () => {
    await registerNewUser(page);
  });

  await test.step('First-run setup asks where files should live', async () => {
    await expect(page.getByTestId('setup-modal')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Where should your files live?')).toBeVisible();
    await shot(page, '01-first-run-setup.png');
    // Choose "Decide later" — stay on local for now.
    await page.getByTestId('setup-skip').click();
    await expect(page.getByTestId('setup-modal')).toHaveCount(0);
    await beat(page);
  });

  await test.step('An honest banner nudges to connect R2', async () => {
    await expect(page.getByTestId('storage-banner')).toBeVisible();
    await shot(page, '02-ephemeral-banner.png');
  });

  await test.step('Open Settings → Storage from the banner', async () => {
    await page.getByTestId('banner-connect').click();
    await expect(page.getByRole('button', { name: 'Storage' })).toBeVisible();
    // Current backend chip + the R2 connect form are shown.
    await expect(page.getByText('🖥 This server’s disk')).toBeVisible();
    await expect(page.getByTestId('r2-endpoint')).toBeVisible();
    await shot(page, '03-storage-settings-local.png');
  });

  await test.step('Fill the R2 connection form (paste-test-save UX)', async () => {
    await page.getByTestId('r2-endpoint').fill('https://acct.r2.cloudflarestorage.com');
    await page.getByTestId('r2-access').fill('AKIAEXAMPLE');
    await page.getByTestId('r2-secret').fill('super-secret-key-value');
    await page.getByTestId('r2-bucket').fill('acme-floppy');
    await expect(page.getByTestId('r2-save')).toBeVisible();
    await shot(page, '04-r2-form-filled.png');
    // Note: we don't Save here — that would switch the live E2E backend to an
    // unreachable bucket. The connect/save/migrate paths are covered by the
    // backend suite against a fake S3 client.
  });
});

test('A regular (non-first) user never sees storage settings', async ({ page }) => {
  await blockExternal(page);
  // By now at least one account exists, so this one is definitely not the Owner.
  await registerNewUser(page, { email: uniqueEmail() });

  // No first-run setup for a non-owner.
  await expect(page.getByTestId('setup-modal')).toHaveCount(0);
  // No ephemeral banner.
  await expect(page.getByTestId('storage-banner')).toHaveCount(0);

  // And no Storage tab inside Settings.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Storage' })).toHaveCount(0);
});

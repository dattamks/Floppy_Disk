import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

async function upload(page, name, body = 'hello') {
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from(body),
  });
  await expect(page.getByText(name)).toBeVisible();
  await page.keyboard.press('Escape');
}

test('a skeleton shows while the listing loads, not a false "no files"', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'doc.txt');

  // Slow the root listing so the loading state is observable on reload.
  await page.route('**/api/v1/storage/files', async (route) => {
    await new Promise((r) => setTimeout(r, 900));
    return route.continue();
  });
  await page.reload();
  await expect(page.getByTestId('files-loading')).toBeVisible();
  // No misleading empty-state while loading.
  await expect(page.getByText('No files yet')).toHaveCount(0);
  // Eventually the real file arrives and the skeleton goes away.
  await expect(page.getByText('doc.txt')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('files-loading')).toHaveCount(0);
});

test('a failed listing shows an error + retry, not a false empty', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'keep.txt');

  let fail = true;
  await page.route('**/api/v1/storage/files', (route) =>
    fail ? route.fulfill({ status: 500, body: '{"detail":"boom"}' }) : route.continue()
  );
  await page.reload();
  await expect(page.getByTestId('files-error')).toBeVisible();
  await expect(page.getByText('No files yet')).toHaveCount(0);

  // Retry succeeds once the backend recovers.
  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('keep.txt')).toBeVisible();
  await expect(page.getByTestId('files-error')).toHaveCount(0);
});

test('starring a file persists across a reload', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'fav.txt');

  await page.getByRole('button', { name: 'Star', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Unstar' })).toBeVisible();

  await page.reload();
  // The star survived the round-trip to the server.
  await expect(page.getByRole('button', { name: 'Unstar' })).toBeVisible();
});

test('creating a share link confirms with a toast', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'sharable.txt');

  await page.getByText('sharable.txt').click();
  await page.getByRole('button', { name: 'Share', exact: true }).first().click();
  await expect(page.getByText('Share link created')).toBeVisible();
});

test('New folder submits on Enter', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New folder' }).click();
  const input = page.getByLabel('Folder name');
  await expect(input).toBeFocused(); // dialog autofocuses its field
  await input.fill('Reports');
  await input.press('Enter');
  await expect(page.getByText('Reports')).toBeVisible();
});

test('opening a modal moves focus into it', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New folder' }).click();
  // Focus is inside the dialog (the name field), not left on the trigger button.
  await expect(page.getByLabel('Folder name')).toBeFocused();
});

test('registration form submits on Enter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Full name').fill('Enter User');
  await page.locator('input[type="date"]').fill('2000-01-01');
  await page.getByLabel('Email address').fill(`enter-${Date.now()}@floppy.disk`);
  const pw = page.getByLabel('Password', { exact: true });
  await pw.fill('s3cretpass99');
  await pw.press('Enter'); // no button click - Enter alone must submit
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible({ timeout: 10000 });
});

test('a file tile opens with the keyboard', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'keyboard.txt', 'open me');
  const tile = page.getByRole('button', { name: 'Open keyboard.txt' });
  await tile.focus();
  await page.keyboard.press('Enter');
  // The preview opened (its Download action is present).
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
});

test('trashing a file offers Undo that restores it', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'oops.txt');

  // Trash via the context menu (⋯ → Move to trash).
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Move to trash' }).click();
  await expect(page.getByText('oops.txt')).toHaveCount(0);

  // The toast offers Undo, which brings it back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('oops.txt')).toBeVisible();
});

test('a Starred view lists starred files and persists', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'fav.txt');

  await page.getByRole('button', { name: 'Star', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Unstar' })).toBeVisible();

  await page.getByRole('button', { name: 'Starred' }).click();
  await expect(page.getByText('fav.txt')).toBeVisible();

  // A non-starred upload does not appear under Starred.
  await page.getByRole('button', { name: 'My Files' }).click();
  await upload(page, 'plain.txt');
  await page.getByRole('button', { name: 'Starred' }).click();
  await expect(page.getByText('fav.txt')).toBeVisible();
  await expect(page.getByText('plain.txt')).toHaveCount(0);
});

test('dropping OS files on the grid uploads them', async ({ page }) => {
  await registerNewUser(page);

  // Simulate an OS file drag-drop onto the content area via DataTransfer.
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['dropped bytes'], 'dropped.txt', { type: 'text/plain' }));
    const target =
      document.querySelector('[data-testid="files-loading"]') ||
      document.querySelector('main, [style*="overflow"]') ||
      document.body;
    const area = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) || target;
    for (const type of ['dragenter', 'dragover', 'drop']) {
      const ev = new DragEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'dataTransfer', { value: dt });
      area.dispatchEvent(ev);
    }
  });
  await expect(page.getByText('dropped.txt')).toBeVisible({ timeout: 10000 });
});

test('the Security settings expose no cosmetic 2FA toggle', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Security' }).click();
  await expect(page.getByText('Change password')).toBeVisible(); // section rendered
  // The backend has no real second factor, so the misleading toggle is gone.
  await expect(page.getByText('Two-factor authentication')).toHaveCount(0);
});

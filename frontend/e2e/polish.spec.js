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
  await expect(page.getByTestId('files-grid').getByText('Reports')).toBeVisible();
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

test('a shared file appears under Shared and leaves on revoke', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'shareme.txt');

  await page.getByText('shareme.txt').click();
  await page.getByRole('button', { name: 'Share', exact: true }).first().click();
  await expect(page.getByText('Share link created')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Shared' }).click();
  await expect(page.getByText('shareme.txt')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Links' }).click();
  await page.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('button', { name: 'Back to files' }).click();
  await page.getByRole('button', { name: 'Shared' }).click();
  await expect(page.getByText('shareme.txt')).toHaveCount(0);
});

test('the Details panel shows file metadata', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'info.txt', 'hello details');

  await page.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Details' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Type')).toBeVisible();
  await expect(dialog.getByText('TXT file')).toBeVisible();
  await expect(dialog.getByText('Location')).toBeVisible();
  await expect(dialog.getByText('Shared')).toBeVisible();
});

test('Details panel: add a description + tags and they persist', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'summary.txt', 'hello details');

  await page.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Details' }).click();
  const dialog = page.getByRole('dialog');

  // Add a description and two tags (Enter commits each tag into a chip).
  await dialog.getByPlaceholder('Add a description…').fill('Q3 revenue overview');
  const tagInput = dialog.getByLabel('Add a tag');
  await tagInput.fill('finance');
  await tagInput.press('Enter');
  await tagInput.fill('budget');
  await tagInput.press('Enter');
  await expect(dialog.getByText('finance', { exact: true })).toBeVisible();
  await expect(dialog.getByText('budget', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Details saved')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  // Reload and reopen: the metadata survived the round-trip to the server.
  await page.reload();
  await expect(page.getByText('summary.txt')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Details' }).click();
  const dialog2 = page.getByRole('dialog');
  await expect(dialog2.getByPlaceholder('Add a description…')).toHaveValue('Q3 revenue overview');
  await expect(dialog2.getByText('finance', { exact: true })).toBeVisible();
  await expect(dialog2.getByText('budget', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  // Full-text search finds it by a tag word only present in metadata.
  await page.getByPlaceholder('Search files and folders').fill('budget');
  await expect(page.getByText('summary.txt').first()).toBeVisible({ timeout: 10000 });
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('image files show a real thumbnail; typed files show a type icon', async ({ page }) => {
  await registerNewUser(page);

  // An uploaded image renders its own bytes as the card thumbnail (via /raw).
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('shot.png')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('img[src*="/storage/files/"][src*="/raw"]').first()).toBeVisible();

  // A spreadsheet gets the sheet glyph, labelled with its extension.
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'budget.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n'),
  });
  await expect(page.getByText('budget.csv')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('CSV', { exact: true })).toBeVisible();
});

test('uploading a profile photo shows it in Settings', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
  await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
    name: 'me.png', mimeType: 'image/png', buffer: PNG,
  });
  await expect(page.getByRole('img', { name: 'Profile photo' })).toBeVisible();
});

test('changing language updates <html lang> and persists', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('combobox').selectOption('es');
  await expect(page.getByText('Language preference saved')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('trash shows a real retention countdown', async ({ page }) => {
  await registerNewUser(page);
  await upload(page, 'old.txt');
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Move to trash' }).click();
  await page.getByRole('button', { name: 'Trash' }).click();
  await expect(page.getByText(/days left/)).toBeVisible();
});

test('a folder offers a .zip download', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New folder' }).click();
  const input = page.getByLabel('Folder name');
  await input.fill('Bundle');
  await input.press('Enter');
  await expect(page.getByTestId('files-grid').getByText('Bundle')).toBeVisible();
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await expect(page.getByRole('button', { name: 'Download (.zip)' })).toBeVisible();
});

test('the empty home view invites an upload with a call-to-action', async ({ page }) => {
  await registerNewUser(page);
  // A fresh account has no files, so the empty state offers actions, not just text.
  await expect(page.getByText('No files yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add files' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add folder' })).toBeVisible();
  // The CTA opens the uploader.
  await page.getByRole('button', { name: 'Add files' }).click();
  await expect(page.locator('input[type="file"]')).toBeAttached();
});

test('the PWA manifest is linked and served', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
  const res = await page.request.get('/manifest.json');
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).name).toBe('Floppy Disk');
});

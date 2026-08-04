import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('select multiple files and bulk-trash them', async ({ page }) => {
  await registerNewUser(page);

  // Upload two files at the root.
  for (const name of ['one.txt', 'two.txt']) {
    await page.getByRole('button', { name: 'Upload' }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });
    await page.keyboard.press('Escape');
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  // Select both via their card checkboxes (find the checkbox in each card).
  const checkbox = (name) =>
    page
      .getByText(name, { exact: true })
      .first()
      .locator('xpath=ancestor::div[.//*[@aria-label="Select"]][1]')
      .getByLabel('Select');
  await checkbox('one.txt').click();
  await checkbox('two.txt').click();

  // The selection bar reports the count; bulk-trash them.
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Trash', exact: true }).click();

  // Both leave the active listing.
  await expect(page.getByText('one.txt', { exact: true })).toHaveCount(0);
  await expect(page.getByText('two.txt', { exact: true })).toHaveCount(0);
});

test('keyboard select-all and Delete trashes the whole listing', async ({ page }) => {
  await registerNewUser(page);
  for (const name of ['ka.txt', 'kb.txt', 'kc.txt']) {
    await page.getByRole('button', { name: 'Upload' }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });
    await page.keyboard.press('Escape');
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  // Ctrl+A selects every item, Delete moves them all to trash.
  await page.mouse.move(400, 400);
  await page.keyboard.press('Control+a');
  await expect(page.getByText('3 selected')).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(page.getByText('ka.txt', { exact: true })).toHaveCount(0);
  await expect(page.getByText('kc.txt', { exact: true })).toHaveCount(0);
});

test('selecting multiple files downloads them as one .zip', async ({ page }) => {
  await registerNewUser(page);
  for (const name of ['one.txt', 'two.txt']) {
    await page.getByRole('button', { name: 'Upload' }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });
    await page.keyboard.press('Escape');
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  const checkbox = (name) =>
    page
      .getByText(name, { exact: true })
      .first()
      .locator('xpath=ancestor::div[.//*[@aria-label="Select"]][1]')
      .getByLabel('Select');
  await checkbox('one.txt').click();
  await checkbox('two.txt').click();
  await expect(page.getByText('2 selected')).toBeVisible();

  // Clicking the bulk Download takes the "bundle into a zip" path (the download
  // opens in a new tab, so we assert the confirming toast rather than the popup).
  const bar = page.getByTestId('selection-bar');
  await bar.getByRole('button', { name: 'Download' }).click();
  await expect(page.getByText('Preparing your download…')).toBeVisible();

  // And the bulk endpoint really returns one zip covering both files.
  const files = await (await page.request.get('/api/v1/storage/files')).json();
  const ids = files.map((f) => f.id);
  expect(ids.length).toBeGreaterThanOrEqual(2);
  const res = await page.request.get(`/api/v1/storage/download?ids=${ids.join(',')}`);
  expect(res.headers()['content-type']).toContain('application/zip');
  const body = await res.body();
  expect(body.slice(0, 2).toString('latin1')).toBe('PK'); // zip magic bytes
});

test('Trash view supports bulk restore', async ({ page }) => {
  await registerNewUser(page);
  for (const name of ['r1.txt', 'r2.txt']) {
    await page.getByRole('button', { name: 'Upload' }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });
    await page.keyboard.press('Escape');
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  // Trash both.
  await page.mouse.move(400, 400);
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await expect(page.getByText('r1.txt', { exact: true })).toHaveCount(0);

  // In Trash, the bulk bar offers Restore / Delete permanently instead.
  await page.getByText('Trash', { exact: false }).first().click();
  await expect(page.getByText('r1.txt', { exact: true }).first()).toBeVisible();
  await page.mouse.move(400, 400);
  await page.keyboard.press('Control+a');
  const bar = page.getByTestId('selection-bar');
  await expect(bar.getByText('2 selected')).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Delete permanently' })).toBeVisible();
  await bar.getByRole('button', { name: 'Restore', exact: true }).click();

  // Back in My Files, the restored files are listed again.
  await page.getByText('My Files', { exact: false }).first().click();
  await expect(page.getByText('r1.txt', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('r2.txt', { exact: true }).first()).toBeVisible();
});

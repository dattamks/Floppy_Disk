import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockExternal, registerNewUser } from './helpers.js';

// End-to-end "Google Drive" use case, recorded as a demo video. Exercises:
// create folders, name-collision auto-suffix, upload varied file types, the
// inline viewers (image / Markdown / JSON / YAML), rename, move (file & folder),
// and delete → restore with name reuse (the "restore gets a variant" behaviour).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE = path.resolve(__dirname, 'fixtures', 'beach-sunset.png');

async function beat(page, ms = 550) {
  await page.waitForTimeout(ms); // small pauses keep the recording watchable
}

async function newFolder(page, name) {
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill(name);
  await page.getByRole('button', { name: 'Create folder' }).click();
  await beat(page);
}

async function uploadText(page, name, mimeType, body) {
  await page.getByRole('button', { name: 'Upload' }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType, buffer: Buffer.from(body) });
  await page.keyboard.press('Escape');
  await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 15000 });
  await beat(page);
}

async function ctx(page, label) {
  // Right-click the item card and return the (scoped) context menu locator.
  await page.getByText(label, { exact: true }).first().click({ button: 'right' });
  return page.getByTestId('ctx-menu');
}

test('Drive use case: folders, viewers, rename, move, delete/restore + naming', async ({
  page,
}) => {
  await blockExternal(page);
  await registerNewUser(page);

  await test.step('Create folders', async () => {
    await newFolder(page, 'Projects');
    await newFolder(page, 'Archive');
    await expect(page.getByText('Projects', { exact: true }).first()).toBeVisible();
  });

  await test.step('Folder naming sense: duplicate name auto-suffixes', async () => {
    await newFolder(page, 'Projects'); // collides -> "Projects (2)"
    await expect(page.getByText('Projects (2)', { exact: true })).toBeVisible();
  });

  await test.step('Upload varied file types', async () => {
    await uploadText(
      page,
      'notes.md',
      'text/markdown',
      '# Meeting notes\n\nAgenda for the **Floppy Disk** sync:\n\n- Ship folders\n- Wire the viewers\n- Record the demo\n\nInline `code` and a [link](https://example.com).\n'
    );
    await uploadText(
      page,
      'data.json',
      'application/json',
      '{"app":"floppy","folders":3,"ready":true}'
    );
    await uploadText(
      page,
      'config.yaml',
      'text/yaml',
      'server:\n  host: localhost\n  port: 8000\n'
    );
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.locator('input[type="file"]').setInputFiles(IMAGE);
    await page.keyboard.press('Escape');
    await expect(page.getByText('beach-sunset.png', { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
    await beat(page);
  });

  await test.step('Viewers: Markdown, JSON, image', async () => {
    await page.getByText('notes.md', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Meeting notes' })).toBeVisible({
      timeout: 15000,
    });
    await beat(page, 900);
    await page.keyboard.press('Escape');

    await page.getByText('data.json', { exact: true }).first().click();
    await expect(page.getByText('"app": "floppy"')).toBeVisible({ timeout: 15000 });
    await beat(page, 800);
    await page.keyboard.press('Escape');

    await page.getByText('beach-sunset.png', { exact: false }).first().click();
    await expect(page.getByRole('dialog').locator('img')).toBeVisible({ timeout: 15000 });
    await beat(page, 800);
    await page.keyboard.press('Escape');
  });

  await test.step('Rename a file', async () => {
    const m = await ctx(page, 'notes.md');
    await m.getByRole('button', { name: 'Rename' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Name').fill('readme.md');
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await expect(page.getByText('readme.md', { exact: true }).first()).toBeVisible();
    await beat(page);
  });

  await test.step('Move a file into a folder', async () => {
    const m = await ctx(page, 'readme.md');
    await m.getByRole('button', { name: 'Move to…' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Projects', exact: true }).click();
    await dialog.getByRole('button', { name: 'Move here' }).click();
    await beat(page);
    // Open the folder and confirm the file landed there.
    await page.getByText('Projects', { exact: true }).first().click();
    await expect(page.getByText('readme.md', { exact: true }).first()).toBeVisible();
    await beat(page, 800);
    await page.getByText('My Files', { exact: true }).first().click();
  });

  await test.step('Move a folder into another folder', async () => {
    const m = await ctx(page, 'Archive');
    await m.getByRole('button', { name: 'Move to…' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Projects', exact: true }).click();
    await dialog.getByRole('button', { name: 'Move here' }).click();
    await beat(page);
    await expect(page.getByText('Archive', { exact: true })).toHaveCount(0); // gone from root
  });

  await test.step('Delete a folder, reuse its name, then restore the original', async () => {
    await newFolder(page, 'Reports');
    const m1 = await ctx(page, 'Reports');
    await m1.getByRole('button', { name: 'Move to trash' }).click();
    await beat(page);
    await newFolder(page, 'Reports'); // reuse the freed name
    await expect(page.getByText('Reports', { exact: true }).first()).toBeVisible();

    // Restore the original from Trash -> it comes back under a variant name.
    await page.getByText('Trash', { exact: false }).first().click();
    const m2 = await ctx(page, 'Reports');
    await m2.getByRole('button', { name: 'Restore' }).click();
    await beat(page);
    await page.getByText('My Files', { exact: true }).first().click();
    await expect(page.getByText('Reports (2)', { exact: true })).toBeVisible();
    await beat(page, 900);
  });
});

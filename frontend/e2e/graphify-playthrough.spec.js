import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockExternal, registerNewUser } from './helpers.js';

// Play the role of a real user, end to end, as recorded proof:
//   register -> create a folder -> upload every media type -> see the knowledge
//   graph via "Related files" -> search -> mint a full key and a FOLDER-SCOPED
//   key in the Developer tab. Video + screenshots land under
//   test-results/playthrough/.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE = path.resolve(__dirname, 'fixtures', 'beach-sunset.png');
const SHOTS = path.resolve(__dirname, '..', 'test-results', 'playthrough');

async function beat(page, ms = 500) {
  await page.waitForTimeout(ms);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: false });
}
async function uploadBuffer(page, name, mimeType, body) {
  await page.getByRole('button', { name: 'Upload' }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType, buffer: Buffer.from(body) });
  await page.keyboard.press('Escape');
  await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 15000 });
  await beat(page, 250);
}

test('Graphify + folder-scope playthrough (recorded)', async ({ page }) => {
  test.setTimeout(180000);
  await blockExternal(page);
  await registerNewUser(page);
  await shot(page, '00-empty-home.png');

  await test.step('Create a folder (scope target)', async () => {
    await page.getByRole('button', { name: 'New folder' }).click();
    await page.getByPlaceholder('Folder name').fill('Projects');
    await page.getByRole('button', { name: 'Create folder' }).click();
    await expect(page.getByText('Projects', { exact: true }).first()).toBeVisible();
    await beat(page);
  });

  await test.step('Upload every media type', async () => {
    // A doc that names two other files -> should yield REFERENCES edges.
    await uploadBuffer(
      page,
      'report.txt',
      'text/plain',
      'Quarterly report. See invoice.csv for numbers and logo.png for the brand.'
    );
    await uploadBuffer(page, 'invoice.csv', 'text/csv', 'item,amount\nwidget,42\n');
    await uploadBuffer(page, 'invoice-2024.csv', 'text/csv', 'item,amount\ngadget,7\n');
    await uploadBuffer(
      page,
      'notes.md',
      'text/markdown',
      '# Notes\n\nProject plan for **Floppy Disk**.\n'
    );
    await uploadBuffer(page, 'data.json', 'application/json', '{"app":"floppy","ready":true}');
    await uploadBuffer(page, 'song.mp3', 'audio/mpeg', 'ID3 fake audio bytes for testing only');
    await uploadBuffer(page, 'voice.wav', 'audio/wav', 'RIFF fake wav bytes for testing only');
    await uploadBuffer(page, 'clip.mp4', 'video/mp4', 'fake mp4 bytes for testing only');
    await uploadBuffer(page, 'brochure.pdf', 'application/pdf', '%PDF-1.4 fake pdf bytes');
    // A real PNG fixture (exercises the image path).
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.locator('input[type="file"]').setInputFiles(IMAGE);
    await page.keyboard.press('Escape');
    await expect(page.getByText('beach-sunset.png', { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
    await beat(page, 600);
    await shot(page, '01-all-media-uploaded.png');
  });

  await test.step('Knowledge graph: Related files', async () => {
    await page.getByText('report.txt', { exact: true }).first().click({ button: 'right' });
    const menu = page.getByTestId('ctx-menu');
    await menu.getByRole('button', { name: 'Related files' }).click();
    await expect(page.getByText(/Related to/)).toBeVisible({ timeout: 15000 });
    await beat(page, 800);
    await shot(page, '02-related-files.png');
    await page.keyboard.press('Escape');
  });

  await test.step('Related files for a shared-name sibling', async () => {
    await page.getByText('invoice.csv', { exact: true }).first().click({ button: 'right' });
    await page.getByTestId('ctx-menu').getByRole('button', { name: 'Related files' }).click();
    await expect(page.getByText(/Related to/)).toBeVisible({ timeout: 15000 });
    await beat(page, 700);
    await shot(page, '03-related-sibling.png');
    await page.keyboard.press('Escape');
  });

  await test.step('Search', async () => {
    await page.getByPlaceholder('Search files and folders').fill('invoice');
    await beat(page, 900);
    await shot(page, '04-search.png');
    await page.getByPlaceholder('Search files and folders').fill('');
    await beat(page, 300);
  });

  await test.step('Knowledge graph view (node/edge diagram)', async () => {
    await page.getByRole('button', { name: 'Knowledge graph' }).click();
    await expect(page.getByText(/nodes ·/)).toBeVisible({ timeout: 15000 });
    // Controls are present (search, type filters, local-graph, reset).
    await expect(page.getByPlaceholder('Search nodes…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Local graph' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
    await beat(page, 3200); // let the force layout settle
    await shot(page, '07-graph-view.png');
    // Exercise a type filter + search highlight.
    await page.getByRole('button', { name: 'Audio' }).click();
    await page.getByPlaceholder('Search nodes…').fill('invoice');
    await beat(page, 700);
    await shot(page, '08-graph-filtered.png');
    await page.keyboard.press('Escape');
  });

  await test.step('Developer: mint a full-access key', async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Developer' }).click();
    await beat(page, 400);
    await page.getByPlaceholder('Name (e.g. local-llm, n8n)').fill('local-llm');
    await page.getByRole('button', { name: 'Create key' }).click();
    await expect(page.getByText('Copy your key now', { exact: false })).toBeVisible({ timeout: 10000 });
    await beat(page, 700);
    await shot(page, '05-full-key-token.png');
    await page.getByRole('button', { name: 'Done' }).click();
  });

  await test.step('Developer: mint a FOLDER-SCOPED key', async () => {
    await page.getByPlaceholder('Name (e.g. local-llm, n8n)').fill('acme-scoped');
    await page.locator('select').selectOption({ label: 'Limit to “Projects”' });
    await page.getByRole('button', { name: 'Create key' }).click();
    await expect(page.getByText('Copy your key now', { exact: false })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await beat(page, 500);
    // Both keys listed, one tagged with its folder scope.
    await expect(page.getByText('local-llm')).toBeVisible();
    await expect(page.getByText('acme-scoped')).toBeVisible();
    await expect(page.getByText(/Folder: Projects/)).toBeVisible();
    await shot(page, '06-keys-list.png');
  });
});

import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { blockExternal, registerNewUser } from './helpers.js';

// One continuous walkthrough of EVERY note feature, recorded as a single video
// (stitched to MP4 afterwards). It also proves the round-trip — callouts, media,
// highlight and images survive save → full reload → reopen — and captures real
// .md / .html exports to e2e/exports/ so they can be delivered as artifacts.
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } }, viewport: { width: 1440, height: 900 } });
const beat = (page, ms = 600) => page.waitForTimeout(ms);
const OUT = path.resolve('e2e/exports');

const PNG = readFileSync(path.resolve('e2e/fixtures/map.png')); // a real, visible image (~76 KB → embeds)
// A >1 MB "video" so it demonstrates the media/ folder in the export bundle
// (the ftyp header up front keeps it recognizably an mp4; the rest is padding).
const MP4 = Buffer.concat([Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex'), Buffer.alloc(1_300_000)]);
const MP3 = Buffer.from('494433030000000000', 'hex'); // small → embeds

async function slash(page, query, exactLabel) {
  await page.keyboard.type('/' + query, { delay: 16 });
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await beat(page, 200);
  await page.getByTestId('slash-item').filter({ hasText: exactLabel }).first().click();
  await beat(page, 240);
}

// Place the caret in a fresh empty top-level paragraph, so the next block is
// created at the document root, never nested in a container. TrailingNode keeps
// an empty paragraph after container blocks; after a text paragraph we open a
// new line.
async function toEnd(page) {
  const p = page.locator('.ProseMirror > p').last();
  await p.click();
  await page.keyboard.press('End');
  const txt = (await p.textContent()) || '';
  if (txt.trim().length) await page.keyboard.press('Enter');
  await beat(page, 130);
}

test('note feature tour: every block, media, bubble, callouts, export + round-trip', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await blockExternal(page);
  await registerNewUser(page);

  // ---- New note ---------------------------------------------------------
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Field Notes — Feature Tour');
  const ed = page.locator('.ProseMirror');
  await ed.click();
  await beat(page);

  // ---- Heading (slash) + a paragraph ------------------------------------
  await slash(page, 'h1', /^Heading 1$/);
  await page.keyboard.type('Overview', { delay: 14 });
  await toEnd(page);
  await page.keyboard.type('A quick tour of everything a note can hold.', { delay: 7 });
  await beat(page);

  // ---- Bubble toolbar: select the line, bold + highlight ----------------
  await toEnd(page);
  await page.keyboard.type('This whole line is important.', { delay: 9 });
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await beat(page, 350);
  await expect(page.getByTestId('note-bubble')).toBeVisible();
  await page.getByTestId('bubble-bold').click();
  await page.getByTestId('bubble-highlight').click();
  await beat(page, 450);

  // ---- Heading 2 + lists ------------------------------------------------
  await toEnd(page);
  await slash(page, 'h2', /^Heading 2$/);
  await page.keyboard.type('Checklist & lists', { delay: 11 });
  await toEnd(page);
  await slash(page, 'todo', /^To-do list$/);
  await page.keyboard.type('Ship the note editor', { delay: 7 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Record the walkthrough', { delay: 7 });
  await toEnd(page);
  await slash(page, 'bullet', /^Bulleted list$/);
  await page.keyboard.type('A bullet point', { delay: 7 });
  await beat(page);

  // ---- Callouts (info + warning) ----------------------------------------
  await toEnd(page);
  await slash(page, 'callout', /^Callout$/);
  await page.keyboard.type('Callouts group related context in a colored panel.', { delay: 6 });
  await expect(ed.locator('[data-callout="info"]')).toBeVisible();
  await toEnd(page);
  await slash(page, 'warning', /^Warning callout$/);
  await page.keyboard.type('Warnings stand out in amber.', { delay: 6 });
  await expect(ed.locator('[data-callout="warning"]')).toBeVisible();
  await beat(page);

  // ---- Divider ----------------------------------------------------------
  await toEnd(page);
  await slash(page, 'divider', /^Divider$/);
  await expect(ed.locator('hr')).toHaveCount(1);
  await beat(page);

  // ---- Code block -------------------------------------------------------
  await toEnd(page);
  await slash(page, 'code', /^Code block$/);
  await page.keyboard.type("const note = 'markdown';", { delay: 7 });
  await expect(ed.locator('pre code')).toBeVisible();
  await beat(page);

  // ---- Table ------------------------------------------------------------
  await toEnd(page);
  await slash(page, 'table', /^Table$/);
  await expect(ed.locator('table')).toBeVisible();
  await page.keyboard.type('Feature', { delay: 7 });
  await beat(page, 400);

  // ---- Heading + wiki-link + media --------------------------------------
  await toEnd(page);
  await slash(page, 'h2', /^Heading 2$/);
  await page.keyboard.type('Media', { delay: 11 });
  await toEnd(page);
  await page.keyboard.type('Related: [[Coast Guide]] — see the map below.', { delay: 6 });
  await beat(page);

  // ---- Inline image (upload) --------------------------------------------
  await toEnd(page);
  await slash(page, 'image', /^Image$/);
  await page.setInputFiles('[data-testid="note-file-input"]', { name: 'map.png', mimeType: 'image/png', buffer: PNG });
  await expect(ed.locator('img')).toBeVisible({ timeout: 10000 });
  await expect(ed.locator('img')).toHaveAttribute('src', /\/storage\/files\/.+\/raw/);
  await beat(page, 700);

  // ---- Inline video (upload) --------------------------------------------
  await toEnd(page);
  await slash(page, 'file', /^File attachment$/);
  await page.setInputFiles('[data-testid="note-file-input"]', { name: 'clip.mp4', mimeType: 'video/mp4', buffer: MP4 });
  await expect(ed.locator('video')).toBeVisible({ timeout: 10000 });
  await beat(page, 600);

  // ---- Inline audio (upload) --------------------------------------------
  await toEnd(page);
  await slash(page, 'file', /^File attachment$/);
  await page.setInputFiles('[data-testid="note-file-input"]', { name: 'tune.mp3', mimeType: 'audio/mpeg', buffer: MP3 });
  await expect(ed.locator('audio')).toBeVisible({ timeout: 10000 });
  await beat(page, 600);

  // ---- File attachment chip (pdf) ---------------------------------------
  await toEnd(page);
  await slash(page, 'file', /^File attachment$/);
  await page.setInputFiles('[data-testid="note-file-input"]', { name: 'itinerary.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 trip') });
  await expect(ed.locator('a[href*="/raw"]')).toContainText('itinerary.pdf', { timeout: 10000 });
  await beat(page, 700);

  // ---- Block drag-handle appears on hover -------------------------------
  await ed.locator('h1').first().hover();
  await beat(page, 400);
  await expect(page.locator('.drag-handle')).toHaveCount(1);
  await beat(page, 300);

  // ---- Save -------------------------------------------------------------
  await page.getByTestId('file-page-save').click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });
  await beat(page, 500);

  // ---- Image lightbox (select the image → expand button) ----------------
  await ed.locator('.note-figure img').click();
  await page.getByTestId('note-image-expand').click();
  await expect(page.getByTestId('note-lightbox')).toBeVisible();
  await beat(page, 900);
  await page.getByLabel('Close preview').click();
  await expect(page.getByTestId('note-lightbox')).toBeHidden();
  await beat(page, 400);

  // ---- Round-trip: source view shows the persisted structures ----------
  await page.getByTestId('file-page-source').click();
  const raw = await page.locator('textarea').first().inputValue();
  expect(raw).toContain('data-callout="info"');
  expect(raw).toContain('data-callout="warning"');
  expect(raw).toMatch(/<video[^>]+\/raw/);
  expect(raw).toMatch(/<audio[^>]+\/raw/);
  expect(raw).toMatch(/!\[[^\]]*\]\([^)]*\/raw\)/);
  expect(raw).toMatch(/<mark>/); // highlight persists as a <mark> tag
  expect(raw).toContain('[[Coast Guide]]');
  await beat(page, 500);
  await page.getByTestId('file-page-source').click(); // back to editor
  await beat(page, 400);

  // ---- Round-trip: full reload + reopen, features still render ----------
  await page.reload();
  await page.getByRole('button', { name: 'Upload', exact: true }).waitFor({ timeout: 20000 });
  // The owner first-run storage modal re-appears after a reload; dismiss it.
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) {
    await page.getByTestId('setup-skip').click();
    await setup.waitFor({ state: 'hidden' }).catch(() => {});
  }
  const card = page.getByText('Field Notes', { exact: false }).first();
  await card.waitFor({ state: 'visible', timeout: 15000 });
  await card.click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await expect(page.locator('.ProseMirror [data-callout="info"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.ProseMirror [data-callout="warning"]')).toBeVisible();
  await expect(page.locator('.ProseMirror video')).toBeVisible();
  await expect(page.locator('.ProseMirror audio')).toBeVisible();
  await expect(page.locator('.ProseMirror img')).toBeVisible();
  await expect(page.locator('.ProseMirror mark')).toBeVisible();
  await beat(page, 700);

  // ---- Export as a Markdown bundle + an HTML bundle (.zip: index + media/ +
  //      sources/). The note has a >1 MB video and a PDF attachment, so both
  //      exports bundle. Saved as real artifacts for delivery/inspection.
  const isZip = (p) => { const b = readFileSync(p); return b[0] === 0x50 && b[1] === 0x4b; }; // PK magic
  await page.getByTestId('note-export').click();
  const [mdDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('note-export-md').click(),
  ]);
  const mdZip = path.join(OUT, 'field-notes-md.zip');
  await mdDl.saveAs(mdZip);
  expect(isZip(mdZip)).toBe(true);
  await beat(page, 500);
  await page.getByTestId('note-export').click();
  const [htmlDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('note-export-html').click(),
  ]);
  const htmlZip = path.join(OUT, 'field-notes-html.zip');
  await htmlDl.saveAs(htmlZip);
  expect(isZip(htmlZip)).toBe(true);
  await beat(page, 800);
});

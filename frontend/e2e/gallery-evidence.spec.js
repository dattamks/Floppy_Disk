import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Recorded, human-paced walkthrough of the Gallery for the demo video.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });

const beat = (page, ms = 600) => page.waitForTimeout(ms);

// Distinct tiny solid-colour PNGs so tiles look different in the video.
const PNG = (b64) => Buffer.from(b64, 'base64');
const RED = PNG('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
const GRN = PNG('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
const BLU = PNG('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');

async function upload(page, name, mimeType, buffer) {
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
  await expect(page.getByText(name)).toBeVisible();
  await page.keyboard.press('Escape');
}

test('Gallery walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  await upload(page, 'red.png', 'image/png', RED);
  await upload(page, 'green.png', 'image/png', GRN);
  await upload(page, 'blue.png', 'image/png', BLU);
  await upload(page, 'clip.mp4', 'video/mp4', Buffer.from('\x00\x00\x00\x18ftypmp42fake'));
  await upload(page, 'track.mp3', 'audio/mpeg', Buffer.from('ID3\x03\x00\x00\x00fake-audio'));

  await page.getByRole('button', { name: 'Gallery' }).click();
  await expect(page.getByTestId('gallery-page')).toBeVisible();
  await beat(page);

  // Categories: Photos then Videos.
  await expect(page.getByTestId('gallery-section-image')).toBeVisible();
  await expect(page.getByTestId('gallery-section-video')).toBeVisible();
  await beat(page);

  // Filter to Photos, then back to All.
  await page.getByTestId('gallery-filter-image').click(); await beat(page, 500);
  await page.getByTestId('gallery-filter-all').click(); await beat(page, 500);

  // Open a photo -> page forward/back.
  await page.getByTestId('gallery-tile').first().click();
  await expect(page.getByTestId('gallery-lightbox')).toBeVisible();
  await beat(page);
  await page.getByTestId('gallery-next').click(); await beat(page, 550);
  await page.getByTestId('gallery-next').click(); await beat(page, 550);
  await page.getByTestId('gallery-prev').click(); await beat(page, 550);
  // Info from the lightbox.
  await page.getByTestId('lightbox-info').click();
  await expect(page.getByTestId('gallery-info')).toBeVisible();
  await beat(page, 900);
  await page.getByTestId('gallery-info').getByLabel('Close').click();
  await page.keyboard.press('Escape'); // close lightbox
  await beat(page);

  // A video plays inline.
  await page.getByTestId('gallery-filter-video').click(); await beat(page, 400);
  await page.getByTestId('gallery-tile').first().click();
  await expect(page.getByTestId('gallery-lightbox').locator('video')).toBeVisible();
  await beat(page, 900);
  await page.keyboard.press('Escape');
  await beat(page);

  // An audio track plays inline too.
  await page.getByTestId('gallery-filter-audio').click(); await beat(page, 400);
  await page.getByTestId('gallery-tile').first().click();
  await expect(page.getByTestId('gallery-lightbox').locator('audio')).toBeVisible();
  await beat(page, 1100);
  await page.keyboard.press('Escape');
  await beat(page);

  // Photos and videos are grouped by date (a "Today" heading). Toggle it off, then on.
  await page.getByTestId('gallery-filter-all').click(); await beat(page, 400);
  await expect(page.getByTestId('gallery-date-group').first()).toBeVisible();
  await beat(page, 800);
  await page.getByTestId('gallery-group-toggle').click(); await beat(page, 700);
  await page.getByTestId('gallery-group-toggle').click(); await beat(page, 700);

  // Context menu -> move a photo to trash, then Undo from the toast restores it.
  await page.getByTestId('gallery-filter-image').click(); await beat(page, 400);
  await page.getByTestId('gallery-tile').last().click({ button: 'right' });
  await expect(page.getByTestId('gallery-menu')).toBeVisible();
  await beat(page, 700);
  await page.getByTestId('gallery-menu-delete').click();
  await beat(page, 600);
  await page.getByRole('button', { name: 'Undo' }).click();
  await beat(page, 1000);
});

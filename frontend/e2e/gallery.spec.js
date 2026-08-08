import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Gallery: photos + videos in two categories; a photo opens in a pageable
// viewer, a video plays inline; Esc closes.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

// A tiny valid PNG (1x1) so an upload classifies as an image.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function upload(page, name, mimeType, buffer) {
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
  await expect(page.getByText(name)).toBeVisible();
  await page.keyboard.press('Escape');
}

test('gallery groups photos + videos and pages through images', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  // Two photos + one "video" + one "audio" (bytes aren't real media, but each
  // classifies by MIME type).
  await upload(page, 'one.png', 'image/png', PNG_1x1);
  await upload(page, 'two.png', 'image/png', PNG_1x1);
  await upload(page, 'clip.mp4', 'video/mp4', Buffer.from('\x00\x00\x00\x18ftypmp42fake'));
  await upload(page, 'song.mp3', 'audio/mpeg', Buffer.from('ID3\x03\x00\x00\x00fake-audio'));

  await page.getByRole('button', { name: 'Gallery' }).click();
  await expect(page.getByTestId('gallery-page')).toBeVisible();

  // Three categories, each with its own count.
  const photosSection = page.getByTestId('gallery-section-image');
  const videosSection = page.getByTestId('gallery-section-video');
  const audioSection = page.getByTestId('gallery-section-audio');
  await expect(photosSection).toBeVisible();
  await expect(videosSection).toBeVisible();
  await expect(audioSection).toBeVisible();
  await expect(photosSection.getByTestId('gallery-tile')).toHaveCount(2);
  await expect(videosSection.getByTestId('gallery-tile')).toHaveCount(1);
  await expect(audioSection.getByTestId('gallery-tile')).toHaveCount(1);

  // The Videos filter shows only videos.
  await page.getByTestId('gallery-filter-video').click();
  await expect(page.getByTestId('gallery-section-image')).toHaveCount(0);
  await expect(page.getByTestId('gallery-tile')).toHaveCount(1);

  // The Audio filter shows only audio, and it opens an inline <audio> player.
  await page.getByTestId('gallery-filter-audio').click();
  await expect(page.getByTestId('gallery-section-image')).toHaveCount(0);
  await expect(page.getByTestId('gallery-tile')).toHaveCount(1);
  await page.getByTestId('gallery-tile').first().click();
  await expect(page.getByTestId('gallery-lightbox').locator('audio')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('gallery-lightbox')).toHaveCount(0);

  // The Photos filter shows only photos.
  await page.getByTestId('gallery-filter-image').click();
  await expect(page.getByTestId('gallery-tile')).toHaveCount(2);

  // Open the first photo -> viewer with prev/next; page forward.
  await page.getByTestId('gallery-tile').first().click();
  const lb = page.getByTestId('gallery-lightbox');
  await expect(lb).toBeVisible();
  await expect(lb.locator('img')).toBeVisible();
  await expect(page.getByTestId('gallery-counter')).toHaveText('1 / 2');
  await page.getByTestId('gallery-next').click();
  await expect(page.getByTestId('gallery-counter')).toHaveText('2 / 2');
  // At the end, Next is disabled.
  await expect(page.getByTestId('gallery-next')).toBeDisabled();
  // Arrow-key back.
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('gallery-counter')).toHaveText('1 / 2');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('gallery-lightbox')).toHaveCount(0);

  // A video opens with a <video> player.
  await page.getByTestId('gallery-filter-video').click();
  await page.getByTestId('gallery-tile').first().click();
  await expect(page.getByTestId('gallery-lightbox').locator('video')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('gallery-lightbox')).toHaveCount(0);
});

test('a gallery tile has a context menu: info + move to trash', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  await upload(page, 'keep.png', 'image/png', PNG_1x1);
  await upload(page, 'trash-me.png', 'image/png', PNG_1x1);
  await page.getByRole('button', { name: 'Gallery' }).click();
  await expect(page.getByTestId('gallery-page')).toBeVisible();
  await expect(page.getByTestId('gallery-tile')).toHaveCount(2);

  // Right-click a tile -> context menu; open Info.
  const target = page.getByTestId('gallery-tile').filter({ hasText: 'trash-me.png' });
  await target.click({ button: 'right' });
  await expect(page.getByTestId('gallery-menu')).toBeVisible();
  await page.getByTestId('gallery-menu-info').click();
  const infoPanel = page.getByTestId('gallery-info');
  await expect(infoPanel).toBeVisible();
  await expect(infoPanel).toContainText('trash-me.png');
  await expect(infoPanel).toContainText('Photo');
  // Escape closes the info panel.
  await page.keyboard.press('Escape');
  await expect(infoPanel).toHaveCount(0);

  // Right-click again -> Move to trash removes it.
  await target.click({ button: 'right' });
  await page.getByTestId('gallery-menu-delete').click();
  await expect(page.getByTestId('gallery-tile')).toHaveCount(1);
  await expect(page.getByTestId('gallery-tile').filter({ hasText: 'trash-me.png' })).toHaveCount(0);

  // It really went to Trash (persists across reload as gone from the gallery).
  await page.reload();
  await page.getByRole('button', { name: 'Gallery' }).click();
  await expect(page.getByTestId('gallery-tile')).toHaveCount(1);
});

test('gallery groups by date and undo restores a deleted item', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  await upload(page, 'a.png', 'image/png', PNG_1x1);
  await upload(page, 'b.png', 'image/png', PNG_1x1);
  await page.getByRole('button', { name: 'Gallery' }).click();
  await expect(page.getByTestId('gallery-page')).toBeVisible();

  // Grouping is on by default -> a "Today" date group is shown.
  const group = page.getByTestId('gallery-date-group');
  await expect(group.first()).toBeVisible();
  await expect(group.first()).toContainText('Today');

  // Toggle grouping off -> no date subheadings.
  await page.getByTestId('gallery-group-toggle').click();
  await expect(page.getByTestId('gallery-date-group')).toHaveCount(0);
  await expect(page.getByTestId('gallery-tile')).toHaveCount(2);
  await page.getByTestId('gallery-group-toggle').click(); // back on
  await expect(page.getByTestId('gallery-date-group').first()).toBeVisible();

  // Delete a tile, then Undo from the toast -> it comes back.
  await page.getByTestId('gallery-tile').first().click({ button: 'right' });
  await page.getByTestId('gallery-menu-delete').click();
  await expect(page.getByTestId('gallery-tile')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('gallery-tile')).toHaveCount(2);
});

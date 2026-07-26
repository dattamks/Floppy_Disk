import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

test('an uploaded video yields a real playback descriptor', async ({ page }) => {
  await registerNewUser(page);

  // Upload a small "video" file (kind is derived from the mime type).
  await page.getByRole('button', { name: 'Upload' }).click();
  const [complete] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/complete')),
    page.locator('input[type="file"]').setInputFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake mp4 bytes'),
    }),
  ]);
  const file = await complete.json();
  expect(file.kind).toBe('video');

  // Ask the backend for a playback descriptor via the app's own session.
  const desc = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/storage/files/${id}/play`, {
      method: 'POST',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
      credentials: 'same-origin',
    });
    return { status: r.status, body: await r.json() };
  }, file.id);

  expect(desc.status).toBe(200);
  // Basic inline playback: a direct URL, no streaming-platform tiering.
  expect(desc.body.mode).toBe('direct');
  expect(desc.body.url).toBeTruthy();
  expect(desc.body.max_resolution).toBeUndefined();
});

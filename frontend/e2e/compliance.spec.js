import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('deleting the account ends the session', async ({ page }) => {
  await registerNewUser(page);

  const status = await page.evaluate(async () => {
    const r = await fetch('/api/v1/auth/account/delete', {
      method: 'POST',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
      credentials: 'same-origin',
    });
    return r.status;
  });
  expect(status).toBe(200);

  // Session is gone -> reload lands back on the login screen.
  await page.reload();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload' })).toHaveCount(0);
});

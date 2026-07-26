import { test, expect } from '@playwright/test';

// Unique email per run so the persistent SQLite DB never collides.
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@floppy.disk`;
}

const PASSWORD = 's3cretpass99';

// The demo loads external media (picsum/Google video) that stalls behind the
// agent proxy. Block anything non-local so the app renders fast + deterministically.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }
    return route.abort();
  });
});

async function fillRegister(page, { name, dob, email, password }) {
  await page.getByRole('button', { name: 'Create account' }).click(); // login -> register
  await page.getByPlaceholder('Full name').fill(name);
  await page.locator('input[type="date"]').fill(dob);
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click(); // submit
}

test('register lands in the app and the session survives a reload', async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/');

  // Login screen is shown for a logged-out visitor.
  await expect(page.getByPlaceholder('Email address')).toBeVisible();

  await fillRegister(page, { name: 'E2E User', dob: '2000-01-01', email, password: PASSWORD });

  // Now inside the app: a nav item that never appears on the auth screens.
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();

  // Reload -> /me restores the session, still in the app.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
});

test('under-18 signup is rejected by the backend', async ({ page }) => {
  await page.goto('/');
  await fillRegister(page, {
    name: 'Too Young',
    dob: '2015-01-01',
    email: uniqueEmail(),
    password: PASSWORD,
  });
  // Stays on the register screen with the age error surfaced.
  await expect(page.getByText(/at least 18/i)).toBeVisible();
});

test('log out (via fresh session) then log back in', async ({ page, context }) => {
  const email = uniqueEmail();
  await page.goto('/');
  await fillRegister(page, { name: 'Return User', dob: '1995-06-15', email, password: PASSWORD });
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();

  // Drop the session cookies to simulate a logged-out browser, then log in.
  await context.clearCookies();
  await page.reload();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();

  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
});

// Shared E2E helpers.

// The demo loads external media (picsum/Google video) that stalls behind the
// agent proxy. Block anything non-local so the app renders deterministically.
export async function blockExternal(page) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }
    return route.abort();
  });
}

export function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@floppy.disk`;
}

// Register a fresh account through the UI and land in the app.
export async function registerNewUser(
  page,
  { email = uniqueEmail(), dob = '2000-01-01', dismissSetup = true } = {}
) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByPlaceholder('Full name').fill('E2E User');
  await page.locator('input[type="date"]').fill(dob);
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill('s3cretpass99');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Upload' }).waitFor();
  // If this account is the instance Owner (first user ever), the first-run
  // storage setup appears over the app; dismiss it so specs interact freely.
  const setup = page.getByTestId('setup-modal');
  if (dismissSetup && (await setup.isVisible().catch(() => false))) {
    await page.getByTestId('setup-skip').click();
    await setup.waitFor({ state: 'hidden' }).catch(() => {});
  }
  return email;
}

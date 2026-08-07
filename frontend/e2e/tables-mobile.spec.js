import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Tables on a phone viewport: the toolbar wraps, the grid/board scroll inside
// their own container, and the page body never scrolls horizontally.
test.use({ viewport: { width: 390, height: 780 } });

test('tables is usable and non-overflowing on a phone', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  // Tables nav lives in the mobile drawer - open it via the hamburger.
  await page.getByRole('button', { name: 'Create', exact: true }).waitFor();
  await page.locator('svg path[d="M4 6h16M4 12h16M4 18h16"]').locator('xpath=ancestor::button[1]').click();
  await page.getByRole('button', { name: 'Tables' }).click();
  await page.getByTestId('new-table').click();
  await expect(page.getByTestId('table-grid')).toBeVisible();

  const noBodyOverflow = async () => page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1);

  // Grid view: toolbar controls present, no horizontal page overflow.
  await expect(page.getByTestId('view-grid')).toBeVisible();
  await expect(page.getByTestId('filter-button')).toBeVisible();
  expect(await noBodyOverflow()).toBeTruthy();

  // Board view: still no page overflow (columns scroll inside the board).
  await page.getByTestId('view-kanban').click();
  await expect(page.getByTestId('kanban-board')).toBeVisible();
  expect(await noBodyOverflow()).toBeTruthy();
});

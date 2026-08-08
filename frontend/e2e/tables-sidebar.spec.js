import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Tables secondary sidebar: lists tables, opens them as tabs, switches instantly
// between multiple open tables, and closes tabs.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function renameOpenTable(page, name) {
  const title = page.getByRole('textbox', { name: 'Table name' });
  await title.fill(name);
  await title.press('Enter');
}

test('sidebar lists tables; tabs switch instantly and close', async ({ page }) => {
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Tables' }).click();
  const sidebar = page.getByTestId('tables-sidebar');
  await expect(sidebar).toBeVisible();

  // Create two tables and name them. Wait for each blank table to actually open
  // (the new tab appears + title resets) before renaming.
  await page.getByTestId('new-table').click();
  await expect(page.getByTestId('tables-tab')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Table name' })).toHaveValue('Untitled table');
  await renameOpenTable(page, 'Alpha');
  await page.getByTestId('tables-sidebar-new').click();
  await expect(page.getByTestId('tables-tab')).toHaveCount(2);
  await expect(page.getByRole('textbox', { name: 'Table name' })).toHaveValue('Untitled table');
  await renameOpenTable(page, 'Beta');

  // Both appear in the sidebar and as tabs; Beta is active.
  await expect(sidebar.getByTestId('tables-sidebar-item').filter({ hasText: 'Alpha' })).toBeVisible();
  await expect(sidebar.getByTestId('tables-sidebar-item').filter({ hasText: 'Beta' })).toBeVisible();
  const tabs = page.getByTestId('tables-tab');
  await expect(tabs).toHaveCount(2);
  await expect(page.getByTestId('tables-tab').filter({ hasText: 'Beta' })).toHaveAttribute('data-active', 'true');

  // The active table shows its views under it in the sidebar.
  await expect(sidebar.getByTestId('tables-sidebar-view').first()).toBeVisible();

  // Switch to Alpha from the sidebar -> its tab becomes active (instant, cached).
  await sidebar.getByTestId('tables-sidebar-item').filter({ hasText: 'Alpha' }).click();
  await expect(page.getByTestId('tables-tab').filter({ hasText: 'Alpha' })).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('textbox', { name: 'Table name' })).toHaveValue('Alpha');

  // Switch to Beta via its tab.
  await page.getByTestId('tables-tab').filter({ hasText: 'Beta' }).getByText('Beta').click();
  await expect(page.getByRole('textbox', { name: 'Table name' })).toHaveValue('Beta');

  // Close the Beta tab -> falls back to Alpha; one tab remains.
  await page.getByTestId('tables-tab').filter({ hasText: 'Beta' }).getByTestId('tables-tab-close').click();
  await expect(page.getByTestId('tables-tab')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Table name' })).toHaveValue('Alpha');
});

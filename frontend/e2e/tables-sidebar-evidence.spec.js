import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Recorded walkthrough: the Tables secondary sidebar + tab strip.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 700) => page.waitForTimeout(ms);

async function rename(page, name) {
  const t = page.getByRole('textbox', { name: 'Table name' });
  await t.fill(name); await t.press('Enter');
}

test('Tables sidebar + tabs walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'Tables' }).click();
  await beat(page);

  // Create three tables via the sidebar's + and name them.
  for (const name of ['Tasks', 'Inventory', 'Contacts']) {
    await page.getByTestId(name === 'Tasks' ? 'new-table' : 'tables-sidebar-new').click();
    await expect(page.getByRole('textbox', { name: 'Table name' })).toHaveValue('Untitled table');
    await rename(page, name);
    await beat(page, 600);
  }

  // Switch between tables from the sidebar — instant, cached.
  await page.getByTestId('tables-sidebar-item').filter({ hasText: 'Tasks' }).click(); await beat(page, 800);
  await page.getByTestId('tables-sidebar-item').filter({ hasText: 'Inventory' }).click(); await beat(page, 800);

  // Switch via the tab strip.
  await page.getByTestId('tables-tab').filter({ hasText: 'Contacts' }).getByText('Contacts').click(); await beat(page, 800);
  await page.getByTestId('tables-tab').filter({ hasText: 'Tasks' }).getByText('Tasks').click(); await beat(page, 800);

  // Close a tab.
  await page.getByTestId('tables-tab').filter({ hasText: 'Inventory' }).getByTestId('tables-tab-close').click();
  await beat(page, 1000);
});

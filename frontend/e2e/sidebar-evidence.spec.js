import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Recorded walkthrough: the two-sidebar shell — primary collapse modes + the
// My Files folder-tree secondary sidebar.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });

const beat = (page, ms = 700) => page.waitForTimeout(ms);

async function newFolder(page, name) {
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill(name);
  await page.getByRole('button', { name: 'Create folder' }).click();
  await beat(page, 400);
}

test('Two-sidebar walkthrough', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  const grid = page.getByTestId('files-grid');
  const tree = page.getByTestId('folder-tree');

  // Build a small folder structure.
  await newFolder(page, 'Projects');
  await grid.getByText('Projects', { exact: true }).first().dblclick();
  await newFolder(page, 'Aurora');
  await newFolder(page, 'Borealis');
  await tree.getByTestId('folder-tree-root').click();
  await newFolder(page, 'Archive');
  await beat(page, 800);

  // The folder tree: expand Projects to reveal its subfolders.
  await tree.getByTestId('folder-tree-toggle').first().click();
  await beat(page, 900);
  await tree.getByTestId('folder-tree-open').filter({ hasText: 'Aurora' }).click();
  await beat(page, 900);
  await tree.getByTestId('folder-tree-root').click();
  await beat(page, 700);
  // Expand-all / collapse-all.
  await tree.getByTestId('folder-tree-expand-all').click();
  await beat(page, 800);
  await tree.getByTestId('folder-tree-collapse-all').click();
  await beat(page, 800);

  // In the files view the primary is already an icon rail (the folder tree is
  // the secondary). Gallery has no secondary, so the primary expands there and
  // the manual collapse toggle returns: expanded -> hover -> icons -> expanded.
  await page.getByTestId('nav-gallery').click();
  await beat(page, 900);
  await page.getByTestId('sidebar-collapse-toggle').click(); // hover
  await beat(page, 1000);
  await page.getByTestId('sidebar-collapse-toggle').click(); // icons
  await beat(page, 1000);
  await page.getByTestId('nav-all').hover();
  await beat(page, 700);
  await page.getByTestId('sidebar-collapse-toggle').click(); // back to expanded
  await beat(page, 900);
});

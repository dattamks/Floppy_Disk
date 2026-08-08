import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Two-sidebar shell: the primary nav collapses through three user-controlled
// modes (expanded -> hover -> icons), and the My Files secondary sidebar shows a
// collapsible folder tree that navigates the grid.
test.beforeEach(async ({ page }) => { await blockExternal(page); });

async function newFolder(page, name) {
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByPlaceholder('Folder name').fill(name);
  await page.getByRole('button', { name: 'Create folder' }).click();
}

test('primary auto-collapses to an icon rail beside a secondary sidebar', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  // Files view shows the folder-tree secondary sidebar, so the primary becomes
  // an icon rail: nav labels hidden, and the manual collapse toggle is gone.
  await expect(page.getByTestId('folder-tree')).toBeVisible();
  await expect(page.getByTestId('nav-all').getByText('My Files')).toBeHidden();
  await expect(page.getByTestId('sidebar-collapse-toggle')).toHaveCount(0);

  // Gallery has no secondary sidebar → the primary expands with labels + the
  // manual collapse toggle, which still cycles through the collapse modes.
  await page.getByTestId('nav-gallery').click();
  await expect(page.getByTestId('nav-all').getByText('My Files')).toBeVisible();
  const toggle = page.getByTestId('sidebar-collapse-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click(); // hover -> labels hide when not hovering
  await expect(page.getByTestId('nav-all').getByText('My Files')).toBeHidden();
  await toggle.click(); // icons -> still hidden
  await expect(page.getByTestId('nav-all').getByText('My Files')).toBeHidden();
});

test('folder tree shows nested folders, toggles, and navigates', async ({ page }) => {
  await registerNewUser(page);
  const setup = page.getByTestId('setup-modal');
  await setup.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await setup.isVisible().catch(() => false)) { await page.getByTestId('setup-skip').click(); await setup.waitFor({ state: 'hidden' }).catch(() => {}); }

  const grid = page.getByTestId('files-grid');
  const tree = page.getByTestId('folder-tree');
  await expect(tree).toBeVisible();

  // Create a top-level "Projects" and a nested "Aurora".
  await newFolder(page, 'Projects');
  await grid.getByText('Projects', { exact: true }).first().dblclick();
  await newFolder(page, 'Aurora');
  // Back to root.
  await tree.getByTestId('folder-tree-root').click();

  // The tree shows Projects with a chevron; Aurora is hidden until expanded.
  await expect(tree.getByTestId('folder-tree-open').filter({ hasText: 'Projects' })).toBeVisible();
  await expect(tree.getByTestId('folder-tree-open').filter({ hasText: 'Aurora' })).toHaveCount(0);

  // Expand Projects -> Aurora appears; click it -> grid navigates into Aurora.
  await tree.getByTestId('folder-tree-toggle').first().click();
  const aurora = tree.getByTestId('folder-tree-open').filter({ hasText: 'Aurora' });
  await expect(aurora).toBeVisible();
  await aurora.click();
  // Uploading now lands in Aurora (we're inside it) — confirm via the header/grid.
  await expect(page.getByText('Aurora', { exact: true }).first()).toBeVisible();

  // Collapse all -> Aurora hidden again; Expand all -> visible.
  await tree.getByTestId('folder-tree-collapse-all').click();
  await expect(tree.getByTestId('folder-tree-open').filter({ hasText: 'Aurora' })).toHaveCount(0);
  await tree.getByTestId('folder-tree-expand-all').click();
  await expect(tree.getByTestId('folder-tree-open').filter({ hasText: 'Aurora' })).toBeVisible();
});

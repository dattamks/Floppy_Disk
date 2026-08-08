import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Obsidian-parity pass 4c: the Properties (frontmatter) panel. Leading YAML
// frontmatter renders as an editable key/value table above the body — never as
// raw --- text — and round-trips into the note's Markdown so the graph and
// search see standard frontmatter.
test.use({ video: { mode: 'on', size: { width: 1360, height: 860 } }, viewport: { width: 1360, height: 860 } });
const beat = (page, ms = 450) => page.waitForTimeout(ms);

test('properties parse, edit, add, and round-trip', async ({ page }) => {
  await blockExternal(page);
  await registerNewUser(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByTestId('file-page')).toBeVisible();
  await page.getByLabel('Note title').fill('Playbook');

  // Seed frontmatter + body via the Source view.
  await page.getByTestId('file-page-source').click();
  await page.locator('textarea').first().fill('---\nstatus: draft\nowner: Datta\n---\n\nThe body of the note.');
  await page.getByTestId('file-page-source').click();
  await beat(page, 500);

  // Frontmatter shows as a Properties table; the body is clean (no raw ---).
  const props = page.getByTestId('note-properties');
  await expect(props).toBeVisible();
  const keys = props.getByLabel('Property name');
  await expect(keys.nth(0)).toHaveValue('status');
  await expect(keys.nth(1)).toHaveValue('owner');
  await expect(props.getByLabel('Value of status')).toHaveValue('draft');
  const editor = page.locator('.ProseMirror');
  await expect(editor).toContainText('The body of the note.');
  await expect(editor).not.toContainText('---');
  await expect(editor).not.toContainText('status:');
  await beat(page, 600);

  // Edit a value.
  await props.getByLabel('Value of status').fill('shipped');
  await beat(page, 400);

  // Add a new property.
  await page.getByTestId('note-add-property').click();
  const keyInputs = props.getByLabel('Property name');
  await keyInputs.last().fill('tags');
  await props.getByLabel(/Value of/).last().fill('roadmap');
  await beat(page, 500);

  // Source view proves the round-trip: frontmatter + untouched body.
  await page.getByTestId('file-page-source').click();
  const raw = await page.locator('textarea').first().inputValue();
  expect(raw).toMatch(/status: shipped/);
  expect(raw).toMatch(/owner: Datta/);
  expect(raw).toMatch(/tags: roadmap/);
  expect(raw).toMatch(/The body of the note\./);
  expect(raw.startsWith('---')).toBeTruthy();
  await beat(page, 800);
});

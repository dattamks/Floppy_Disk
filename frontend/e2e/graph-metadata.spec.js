import { test, expect } from '@playwright/test';
import { blockExternal, registerNewUser } from './helpers.js';

// Real-browser proof that editing a file's description/tags from the UI flows
// into the knowledge graph, and that the whole lifecycle (upload -> edit ->
// delete) keeps the graph in sync. The graph is read back through the API using
// the browser context's own session cookies, so we assert on the real server
// state the UI produced - not a client-side fake.
const API = 'http://localhost:8000/api/v1';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

async function graphNode(page, fileName) {
  // Read the graph as the logged-in user and return the node for a file name.
  const res = await page.request.get(`${API}/graph/`);
  expect(res.ok()).toBeTruthy();
  const g = await res.json();
  return g.nodes.find((n) => n.label === fileName) || null;
}

async function upload(page, name, body = 'hello graph') {
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name, mimeType: 'text/plain', buffer: Buffer.from(body),
  });
  await expect(page.getByText(name)).toBeVisible();
  await page.keyboard.press('Escape');
}

test('UI: description/tags edits flow into the graph across the file lifecycle', async ({ page }) => {
  await registerNewUser(page);

  // 1) CREATE — upload a file, it appears as a graph node (no description yet).
  await upload(page, 'report.txt');
  await expect.poll(async () => (await graphNode(page, 'report.txt')) !== null).toBe(true);
  let node = await graphNode(page, 'report.txt');
  expect(node.meta.description).toBeUndefined();

  // 2) EDIT — add a description + two tags from the Details panel and save.
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Details' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Add a description…').fill('Q3 revenue report');
  const tagInput = dialog.getByLabel('Add a tag');
  await tagInput.fill('finance');
  await tagInput.press('Enter');
  await tagInput.fill('q3');
  await tagInput.press('Enter');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Details saved')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  // The graph now carries the description + tags in the node's meta.
  await expect
    .poll(async () => (await graphNode(page, 'report.txt'))?.meta?.description)
    .toBe('Q3 revenue report');
  node = await graphNode(page, 'report.txt');
  expect(node.meta.tags).toEqual(['finance', 'q3']);

  // 3) EDGE — a second file sharing the 'finance' tag links via SHARED_TAG.
  await upload(page, 'budget.txt');
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Details' }).click();
  const d2 = page.getByRole('dialog');
  const tag2 = d2.getByLabel('Add a tag');
  await tag2.fill('finance');
  await tag2.press('Enter');
  await d2.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Details saved')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  await expect
    .poll(async () => {
      const res = await page.request.get(`${API}/graph/`);
      const g = await res.json();
      return g.edges.some((e) => e.rel === 'shared_tag');
    })
    .toBe(true);

  // 4) DELETE — trashing the file removes its node from the graph. (budget.txt
  // is the most-recently-added file, so it's the first ⋯ menu on the grid.)
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Move to trash' }).click();
  await expect
    .poll(async () => (await graphNode(page, 'budget.txt')) === null)
    .toBe(true);
});

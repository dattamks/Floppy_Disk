# Opportunities Shipped + Re-Validation - 2026-07-31

Follow-up to [the install-and-play validation](./2026-07-31-install-and-play.md).
Implemented the logged opportunities (TDD, no regressions) and re-ran the full
"become the user" walkthrough - browser (with **video**), REST, and MCP - on a
**data-rich** account (5 folders, 18 files, cross-referenced documents). One more
real bug surfaced during the walkthrough and was fixed.

**Result:** ✅ Backend **202 passed** (was 174 at the start of this effort;
+28 across all the work). Frontend 19 unit + build green. All three surfaces
exercised on real data; every feature below verified live.

---

## Opportunities shipped

### O1 - Full-text (content) search
Search now matches **document contents**, not just filenames. Document text is
extracted from the blob on upload-complete (and on content-edit) and cached on
`File.content_text`; both search backends query name **and** content (Postgres
weights the name higher). Folder-scoping is preserved. A `reindex_content`
management command backfills documents uploaded before the feature.
- **Proof:** searching `photon` (a word that appears only *inside* files) returns
  7 documents across folders; `unicorn` → the invoice; `tundra` → borealis notes.
  Verified in the browser, REST, and MCP.

### O2 - One-click public share link
Opening Share now shows the **real** minted `/s/<token>` link in a labeled,
selectable field with a state-aware **Copy link** button (disabled until the
link is ready) - replacing a fake `floppy.disk/s/<id>` placeholder that never
matched the real link.
- **Proof:** the tour's Share step captured a real link
  (`…/s/GYDx95xLfDWUEXgvxwwPNQ`).

### O3 - Richer knowledge-graph REFERENCES
The reference scanner now recognizes **Markdown links** `[x](target.md)`,
**path-like tokens** (`./docs/x.md`), and plain-prose mentions - resolving by
full name or stem, de-duplicated across detectors. It reuses the cached
`content_text` instead of re-reading blobs.
- **Proof:** the 18-file dataset produced **38 edges** including **6 "linked in
  Markdown"** and **5 "path reference"** edges (plus folder-contains and
  shared-token edges).

### O4 - Event-driven graph freshness
Uploads and content-edits now **warm the graph asynchronously** in worker-backed
deploys (`schedule_rebuild`), moving the rebuild off both the upload and the
first graph read. In the standalone single-process deploy it stays a no-op so
uploads remain fast, and the existing read-time `ensure_fresh` still guarantees
correctness.

### O5 - API docs polish
`docs/api/` now documents the `folder` upload field (not `folder_id`), the
auto-derived `kind`, the `reservation_id` on complete, root-level listing by
default, full-text search, and folder-scoped keys.

---

## Bug found during re-validation (and fixed)

### Nested folder contents didn't load in the SPA - FIXED
- **Symptom:** logging in and opening a folder showed **"This folder is empty"**
  even though it contained subfolders and files (the backend returned them
  correctly via `?parent=`/`?folder=`).
- **Root cause:** the SPA only ever fetched **root-level** folders/files
  (`listFolders()`/`listFiles()` with no argument) and filtered client-side, so
  nested content was never loaded after a reload or fresh login.
- **Fix:** navigating into a folder now lazily fetches that folder's own
  subfolders and files (`loadFolderContents`) and merges them in. Added an E2E
  regression (`e2e/folder-nesting.spec.js`).
- **Proof:** the tour now shows `My Files / Projects / Aurora` with all 7 nested
  files rendered.

---

## Re-validation walkthrough (video + screenshots)

Recorded a full browser tour on the seeded account (login → browse nested
folders → rendered Markdown preview → **content search "photon"** → Related files
→ **23-node knowledge graph** → **one-click share link** → Developer keys). All
steps green; video captured. Then re-ran REST and MCP against the same data:

| Surface | Content search "photon" | Knowledge graph |
|---|---|---|
| Browser | ✅ 7 results (all content matches) | ✅ 23 nodes · 38 edges, force-directed |
| REST | ✅ 7 results | ✅ 23 nodes · 38 edges |
| MCP | ✅ 7 results (`search_files`) | ✅ 23 nodes · 38 edges (`get_graph`) |

New regression tests: content search (6), richer references (2), graph warming
(3), plus the folder-nesting E2E - on top of the earlier settings (5) and
kind-classification (12) suites.

---

## Still open (diminishing returns)
- PDF **text** extraction for content search/graph (currently plain-text decode).
- A true 10k-node graph stress test and an actual `docker build` of the
  standalone image (components verified; image not built in-sandbox).
- Real SMTP wiring for verification email in a public deploy (console backend by
  default).

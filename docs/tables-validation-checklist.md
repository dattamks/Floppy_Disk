# Tables — user-level validation checklist

A living checklist of the **user-facing behaviours** to validate for the Tables
feature. Run this whenever Tables changes, before shipping. **Append a section
every time a new capability is built** so the suite only ever grows — we never
allow a regression to slip through a gap in coverage.

Each item notes the automated E2E spec that guards it (so a green suite ≈ a
passing checklist), plus manual/UX checks that need an eye.

**How to run the automated coverage** (fresh DB avoids the shared-DB owner-setup
artifact; the first spec's user becomes the instance owner):

```
cd frontend
PW_MANAGED_BROWSER=0 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  BACKEND_PYTHON=python3 E2E_DB=/tmp/floppy-validate.sqlite3 \
  npx playwright test tables --reporter=list
```

Backend + unit + MCP:

```
# backend (from backend/):  env -u DJANGO_SETTINGS_MODULE -u DATABASE_URL python -m pytest apps/tables apps/graph
# unit    (from frontend/): ./node_modules/.bin/vitest run
# mcp     (from mcp/):       env -u DJANGO_SETTINGS_MODULE -u DATABASE_URL python -m pytest
```

Trinity rule: for every capability, confirm it is reflected across **UI + REST
API + MCP + knowledge graph** (or explicitly note why a surface doesn't apply —
e.g. view-only display concerns like filter/group/sort/mode live in the view
config and are read-only through the API/MCP).

---

## 1. Table lifecycle  (`tables.spec.js`)
- [ ] Create a table from the Tables list; it opens with a starter schema + rows (never blank).
- [ ] Rename the table (blur / Enter); the new name persists across reload.
- [ ] Trash a table → it leaves the list; restore → it returns.
- [ ] Row count in the header is accurate.
- **API/MCP:** `list_tables` / `get_table` reflect create + rename; folder-scoped keys see only their subtree.

## 2. Grid editing + field types  (`tables.spec.js`, `tables-field-types.spec.js`, `tables-attachment.spec.js`, `tables-relation.spec.js`, `tables-formula.spec.js`)
- [ ] Keyboard nav (arrows / Tab / Enter / Esc), type-to-edit, per-type inline editors.
- [ ] Every field type edits + displays: text, long text, number, checkbox, single/multi-select, date, url, email, rating, currency, percent, attachment, relation, formula, lookup, rollup.
- [ ] Computed cells (formula/lookup/rollup) are read-only and recompute live as inputs change.
- [ ] Add / rename / delete a column; add a row; edits persist across reload.
- **API/MCP:** `add_field` documents/validates every type; `create_row`/`update_row` coerce values identically to the UI.
- **Graph:** rows appear as nodes; attachment → `ATTACHES`, relation → `RELATES`.

## 3. Grid UX — sort / select / bulk delete / copy / undo  (`tables-grid-ux.spec.js`)
- [ ] Column sort cycles asc → desc → off; sort persists to the view.
- [ ] Row select: click gutter, shift-range, cmd-toggle, drag-paint, header select-all.
- [ ] Bulk delete via the selection bar; Ctrl/Cmd+C copies selected rows/active cell as TSV.
- [ ] Ctrl/Cmd+Z undoes cell edits, added rows, and single/bulk deletes (works after focus leaves the grid).
- **API/MCP:** `delete_rows` bulk endpoint; `bulkDeleteRows`.

## 4. Row-detail modal  (`tables-row-detail.spec.js`)
- [ ] Hover a row → the Expand control appears in the gutter; click opens the modal.
- [ ] Every field edits in the modal (text/number/select/multi/rating/checkbox/attachment/relation; computed read-only).
- [ ] Prev/next navigates rows; title reflects the primary cell (updates on commit).
- [ ] Delete-row from the modal; edits persist across reload.
- **Correctness:** editing two cells in quick succession never drops a field (row PATCH is locked; client reconciles only the field it wrote).

## 5. Filtering  (`tables-filter.spec.js`, `src/lib/tableFilter.test.js`)
- [ ] Add a condition (field / operator / value); the row set narrows live.
- [ ] Operators are type-appropriate (contains/is, numeric compares, empty/not-empty, checkbox checked/unchecked, select is, multi-select has, date before/after).
- [ ] Multiple conditions combine with AND; a half-built condition doesn't blank the table.
- [ ] The Filter button shows the active count; the row-count shows "N of M".
- [ ] Filters persist across reload; Clear all restores every row; deleting a filtered column drops its filter.
- **UX:** the panel dismisses on outside-click / Escape.

## 6. Grouping  (`tables-group.spec.js`, `src/lib/tableGroup.test.js`)
- [ ] Group by a scalar field → collapsible bands with value label + count, ordered sensibly (choice order / numeric / Checked-first / Empty last).
- [ ] Collapse a band → its rows hide; other bands + their rows stay correct.
- [ ] Grouping composes with filters + sort; selection / keyboard / windowing still work.
- [ ] `groupBy` persists across reload (collapse state is per-session); removing the grouped column clears grouping.
- **UX:** group label + count stay pinned left when scrolling horizontally.

## 7. Kanban board  (`tables-kanban.spec.js`)
- [ ] Grid ⇄ Board switch; Board columns come from a single-select field (pickable when several exist).
- [ ] Drag a card between columns → that field changes; empty state guides you to add a Select column if none.
- [ ] Per-column "Add card" seeds a row with that choice; clicking a card opens the row-detail modal.
- [ ] Filtering applies to the board; board mode + column field persist across reload.
- **Correctness:** switching view / dragging never clobbers a previously-set sort/filter/group in the view config.

## 8. Multiple saved views  (`tables-views.spec.js`)
- [ ] A new table starts with one Grid view (one tab).
- [ ] Add a view from the `+` menu (Grid or Board); it becomes a new tab and opens active.
- [ ] Each view keeps its **own** config — a filter/sort/group/board-field on one view does **not** affect another.
- [ ] Switch tabs → the working state reflects that view's config; the board/grid layout follows the view's kind.
- [ ] Rename a view (double-click tab); delete a view (✕ on the active tab) — but never the last one (no delete affordance when one remains).
- [ ] Views + their independent configs persist across reload; reopening lands on the first view.
- **API:** `POST /tables/{id}/views` creates (validates kind); `DELETE /tables/views/{id}` (refuses the last); `get_table` lists all views with config.
- **MCP:** `create_view` / `delete_view`; `get_table` exposes the views list.

## Cross-cutting (check on every Tables change)
- [ ] **No regression:** the full `tables` E2E suite is green, plus backend `apps/tables`+`apps/graph`, frontend Vitest, and MCP smoke.
- [ ] **Responsiveness:** on a phone viewport the toolbar wraps; the grid/board scroll horizontally without breaking the page; the row-detail modal fits.
- [ ] **Smoothness:** windowed grid stays smooth at thousands of rows; optimistic writes with rollback; no layout jank when switching views.
- [ ] **API robustness:** malformed payloads (non-dict `data`, junk row ids) degrade to a clean response, never a 500.
- [ ] **Scope/safety:** table config and storage credentials are never reachable through the API key or MCP — owner cookie session only for owner-gated surfaces; folder-scoped keys stay confined.

# Full end-to-end validation - 2026-07-31

Scope: install/setup, runtime, UI, every screen and flow, REST API, MCP, and the
new owner-configurable storage. Every phase was run for real and recorded; this
document is the summary + the bugs/gaps surfaced.

Branch: `claude/audit-bugs-edge-cases-pap7ma` (PR #6), commit at validation time
`51dc8cc` plus the test fixes below.

## Result at a glance

| Phase | What ran | Result |
|---|---|---|
| Install (standalone) | fresh `migrate` + gunicorn boot on a clean data dir | PASS - all migrations applied, `secret_key` auto-generated (0600), SQLite created, SPA served at `/`, `/health/` 200 |
| Backend suite | `pytest` | **275 passed** |
| MCP suite | `pytest` (mcp/) | **8 passed** |
| REST API drive | live server, automation-client script, 25 assertions | **25/25 pass** (owner reg, 3-step upload, notes, content search, graph, storage admin, sharing, 4 edge cases) |
| Full UI E2E | Playwright, 24 specs, video on | **24/24 pass** (2 stale tests fixed - see below) |
| Runtime storage switch | live: local -> save R2 -> revert | PASS - backend flips with no restart; secret never returned |

## Installation / setup evidence

Fresh standalone boot on an empty `FLOPPY_DATA_DIR`:

- All 40+ migrations apply cleanly, including the new `accounts.0012_user_is_owner`
  and `storage.0011_storageconfig_storagemigration`.
- `secret_key` is generated once with `0600` perms; `floppy.sqlite3` created.
- `GET /health/` -> 200; `GET /` serves the built SPA (`<title>Floppy Disk</title>`);
  `GET /api/v1/auth/me` -> 403 for an anonymous caller.
- Boot log emits the local-storage persistence warning (`[storage] Using LOCAL
  file storage ... configure Cloudflare R2 ...`).

## Features exercised (all working)

Auth/session, folders, 3-step presigned upload + dedup + quota, all viewers,
self-hosted video descriptor, **notes** (one-call create + in-place edit),
**content search** (matched document body text, not just the name),
**knowledge graph** (whole graph + related), **sharing** (public link),
**owner storage admin** (read/test/migrate + non-owner 403), trash + restore,
bulk select, drag-move, rename/move, image gallery, list/grid, mobile.

Runtime storage switch, live and recorded:
`effective_backend: local -> (save R2) -> r2 (secret_set=true, raw secret NOT in
payload) -> (revert) -> local`, with no server restart.

## Bugs / gaps / edge cases surfaced

Honest result: **no product defects were found** in this pass. Everything that
failed was test drift or harness error, plus a couple of minor UX observations.
Details:

1. **Stale test - `edit-content.spec.js` (fixed).** The test opened a `.md`
   file for editing and expected a raw `<textarea>`. Since the notes feature
   shipped, editing a `.md` opens the WYSIWYG note editor (Write | Markdown |
   Preview), and the raw textarea now lives under the **Markdown** tab. The
   product is correct; the test was not updated when notes landed. Fixed the
   test to select the Markdown tab first.

2. **Stale test - `password-reset.spec.js` (fixed).** The test asserted the
   client-side *fallback* phrase ("invalid or has expired"). The server returns
   its own detail ("Invalid or expired token."), which `firstError` correctly
   prefers and the form shows verbatim. Product is correct; fixed the test to
   match the real message.

3. **Test-suite fragility from the owner feature (fixed).** The first-run setup
   modal is a full-screen overlay for the instance Owner (the first registered
   user). Any E2E spec whose user happened to be the first was then blocked by
   that overlay. Made the shared `registerNewUser` helper dismiss the setup
   modal by default (owner-storage spec opts out to walk through it). This is a
   real behavior worth noting: **the Owner's first login is gated by the setup
   modal until they choose or click "Decide later".** Intended, but there is no
   separate close (X) - only the two choices and "Decide later".

4. **Harness bug (not product).** The first REST-drive run double-prefixed the
   local presigned upload URL (`/api/v1` twice) -> 404, which cascaded into
   complete/share/related failing on a file that never received bytes. Fixed the
   script; the re-run passed 25/25. Called out so the earlier red log isn't
   mistaken for a product issue.

### Minor observations (no action taken)

- On R2, dedup for **directly-uploaded** blobs keys on the object ETag (MD5) and
  for **server-written** blobs (notes/edits) on SHA-256, so a note and an
  identical uploaded `.md` would not dedup against each other. Correctness holds
  (each blob maps to real bytes); documented in `r2.py`.
- The migration card only appears when R2 is active **and** there are local
  blobs (or a job exists) - an owner who starts fresh on R2 sees no migration
  prompt, which is correct.

## Evidence recorded

- Phase logs: install, REST drive (25 assertions), backend/MCP suites, E2E run,
  live storage switch.
- 24 Playwright flow videos (one per spec) + failure screenshots.
- Screens: first-run setup, ephemeral banner, Storage settings (local), R2 form,
  WYSIWYG note editor (write/markdown/preview), graphify playthrough stills.

Reproduce: standalone via `docker compose -f docker-compose.standalone.yml up`,
backend `pytest`, MCP `pytest`, UI `npx playwright test` (set `use.video:'on'`
to capture recordings).

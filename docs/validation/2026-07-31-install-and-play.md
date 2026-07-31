# Install-and-Play Validation - 2026-07-31

A full "become the user" validation of the current `main` build, run in a clean
sandbox. Installed the product from our own [`docs/SETUP.md`](../SETUP.md)
(no-Docker standalone path), then exercised it as a **human via the browser**,
as an **automation client via REST**, and as an **LLM via MCP** - the three ways
a real user connects. Every observation, bug, fix, and opportunity is logged
below. Four real bugs were found and fixed on the spot; all fixes ship with
regression tests.

**Result:** ✅ All three surfaces work. Folder-scope isolation holds across
files, search, **and** the knowledge graph on all three. Backend suite **191
passed** (was 174; +17 including the new regression tests).

---

## Environment

- Installed via `docs/SETUP.md` → "Run without Docker": `vite build` →
  `migrate` → `collectstatic` → `gunicorn` (3 workers), standalone profile,
  SQLite, in-process jobs. One process served SPA + API + `/health/`.
- Health: `GET /health/` → `{"status":"ok","database":true}`. SPA and
  `graphSim.worker` chunk both served from the one origin.
- Sandbox note: Python **3.11** (SETUP.md suggests 3.12) - worked fine; the
  guide's 3.12 is a recommendation, not a hard floor.

---

## Bugs found and fixed

All four are in the **standalone (single-container) mode we recommend for
self-hosting** or on the programmatic upload path - i.e. exactly what a new
self-hoster or integrator hits first.

### A. Search always 500s on SQLite  - FIXED
- **Symptom:** `GET /storage/search?q=…` → HTTP 500 in the browser and via API.
- **Root cause:** `standalone.py` inherited `PostgresSearchService` (uses
  `websearch_to_tsquery`, a Postgres-only function) from base, but standalone
  runs on SQLite → `OperationalError: no such function: websearch_to_tsquery`.
- **Fix:** standalone now selects the portable `BasicSearchService` when the DB
  engine is SQLite (and the Postgres FTS service when `DATABASE_URL` points at
  Postgres). Folder-scoping is honored identically by both.

### B. "database is locked" under concurrent uploads  - FIXED
- **Symptom:** a multi-file upload (what the UI does) intermittently 500'd on
  `uploads/…/complete` and `uploads`. Reproduced: **2 of 8** concurrent uploads
  failed; **0 of 12** after the fix.
- **Root cause:** 3 gunicorn workers on one SQLite file with no WAL journal and
  no busy timeout - concurrent writers collided.
- **Fix:** standalone SQLite now runs `journal_mode=WAL`, `busy_timeout=30s`,
  and `transaction_mode=IMMEDIATE`, so a second writer waits for the lock
  instead of erroring. Verified live: 12/12 concurrent uploads succeed.

### C. Verification / reset email links point at `localhost:5173`  - FIXED
- **Symptom:** the sign-up email link was `http://localhost:5173/verify-email…`
  - the dev Vite port, not where the standalone app is actually served.
- **Root cause:** `FRONTEND_BASE_URL` inherited the dev default.
- **Fix:** standalone defaults `FRONTEND_BASE_URL` to the app's own origin
  (`http://localhost:8000`); set it to your public URL for a real deploy.

### D. Knowledge-graph REFERENCES edges silently missing for API/MCP uploads  - FIXED
- **Symptom:** documents uploaded via REST/MCP produced only structural
  `CONTAINS` edges - no content cross-links - even when one doc named another.
  The browser worked; programmatic clients didn't.
- **Root cause:** the server never derived a file's `kind`; it trusted the
  client to send it. The SPA classifies files before upload, but REST/MCP
  clients usually omit `kind`, so every upload defaulted to the generic `file`,
  and the graph's reference scanner (which only reads `doc`-kind files) skipped
  them.
- **Fix:** the server now derives `kind` from the filename/content-type
  (mirroring the SPA's `kindOf`) when the client leaves it at the default; an
  explicit kind is always respected. Verified: an API upload of `notes.md`
  naming `budget.json`/`roadmap.md` now yields `text names "budget.json"` /
  `text names "roadmap.md"` REFERENCES edges (5 edges vs 3 before).

**Regression tests added:** `apps/common/tests/test_standalone_settings.py` (5)
and `apps/storage/tests/test_kind_classification.py` (12).

---

## Surface 1 - Browser (human user)

Registered, created a folder, uploaded a mixed media set (Markdown, JSON, YAML,
text, PNG, PDF), previewed files, searched, opened Related-files and the
Knowledge-graph view, minted an API key in the Developer tab, and viewed Trash.
Screenshots captured at each step.

| Step | Result |
|---|---|
| Register → land in app | ✅ |
| Create folder | ✅ |
| Multi-file upload into folder | ✅ (after fix B) |
| Upload photo at root | ✅ |
| Image preview | ✅ |
| Markdown preview (rendered H1) | ✅ |
| Search | ✅ (after fix A) |
| Related files (graph edges) | ✅ |
| Knowledge graph view (`5 nodes · 6 edges`, physics settled) | ✅ |
| Developer → mint API key | ✅ (key captured) |
| Trash view | ✅ |

**UX observations (not bugs):**
- The share dialog is Google-Drive-style (add people, "Copy link", access
  level). There's no explicit "Create/Generate public link" button - a public
  token link is produced when you set "Anyone with link" and copy. Worth a look:
  a one-click "create public link" affordance would be more discoverable.
- Search is **filename-only** (both the SQLite and Postgres services vector the
  name), so searching a word that only appears in file *content* returns
  nothing. The knowledge graph does read content (for REFERENCES), so full-text
  search is an opportunity, not a regression.

## Surface 2 - REST API (automation client)

Registered, minted a full key and a folder-scoped key, then drove the whole API:
whoami/usage, folder create, uploads into folders, list, download round-trip,
share link create/list, and the graph endpoints (`/graph`, `/graph/search`,
`/graph/rebuild`). All green. **Client-side note:** the upload field is `folder`
(not `folder_id`) and `/storage/files` lists the *root* level by default -
worth making obvious in the API docs.

## Surface 3 - MCP (LLM client)

Launched the server over **stdio** exactly as Claude Code/Desktop do (34 tools
listed, incl. the 4 graph tools), once with a full key and once with a
folder-scoped key. `whoami`, `list_folders`, and `get_graph` all worked.

## Folder-scope isolation - proven on all three surfaces

A key scoped to a "Work"/"Projects" folder must never see a sibling private
folder's files - in listings, search, or the graph. Set up a secret file
(`tax-secret.txt` / `diary.txt`) in a separate folder and checked with the
scoped key:

| Surface | Files | Search | Knowledge graph |
|---|---|---|---|
| REST | ✅ isolated | ✅ isolated | ✅ isolated (only in-scope nodes) |
| MCP | ✅ isolated | - | ✅ isolated (3 in-scope nodes, no private) |

The scoped graph returns only the subtree's nodes; cross-scope edges are clipped
at the boundary, by construction (built globally, read through the same
`scoped_folder_ids` filter).

---

## Opportunities (next pickup - not blocking)

1. **Full-text (content) search** - today search is filename-only. The graph
   already scans document content; a content index would make search much
   stronger. (Postgres FTS could vector content; SQLite could use FTS5.)
2. **One-click "create public link"** in the share dialog for discoverability.
3. **REFERENCES beyond plain filename mentions** - Markdown links, relative
   paths, PDF text - would enrich the graph further.
4. **API docs polish** - call out the `folder` upload field, root-level listing
   default, and the 3-step upload flow with an end-to-end example.
5. **Event-driven graph rebuilds** - currently rebuilt on read when stale; an
   on-upload trigger would keep it fresh with less latency on first view.
6. **`docker build` of `Dockerfile.standalone`** in CI - the components are
   verified, but the image itself hasn't been built in this environment.

---

## Verification summary

- Backend: **191 passed** (all suites, after fixes).
- Concurrency: 12/12 concurrent uploads succeed (was 6/8).
- Search: 200 with results on SQLite (was 500).
- Graph: REFERENCES edges form for API/MCP uploads (was CONTAINS-only).
- Folder-scope: isolated across files/search/graph on REST and MCP.
- 20 browser screenshots captured as proof (attached to the session, not
  committed to the repo).

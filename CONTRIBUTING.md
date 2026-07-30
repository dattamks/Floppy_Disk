# Contributing to Floppy Disk

Thanks for your interest in contributing! Floppy Disk is a self-hostable,
Google-Drive-style file storage app (Django API + React frontend + an MCP
server), licensed under Apache-2.0.

## Repository layout

- `backend/` — Django + DRF API and Celery workers
- `frontend/` — React (Vite) single-page app
- `mcp/` — Python FastMCP server wrapping the REST API
- `docs/` — API reference (`docs/api/`) and change notes

## Local setup

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # then edit as needed
python manage.py migrate
python manage.py runserver
```

Or bring up the whole stack (Postgres + Redis + web + worker + beat) with
`docker compose up --build` from `backend/`.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

## Tests & linting

Please run the relevant suites before opening a PR:

```bash
# backend
cd backend && python -m pytest -q

# frontend unit tests + build
cd frontend && npm run test:unit && npm run build

# frontend end-to-end (boots the backend on SQLite + Vite, drives Chromium)
cd frontend && npx playwright install chromium && npm run test:e2e

# mcp (imports the server and lists tools)
cd mcp && pip install -r requirements.txt && \
  python -c "import asyncio, floppy_mcp.server as s; print(len(asyncio.run(s.mcp.list_tools())))"
```

`ruff` is used for backend linting and `prettier` for the frontend.

## Pull requests

- Keep changes focused; one logical change per PR.
- Add or update tests for behavior changes.
- Make sure CI is green (`.github/workflows/ci.yml` runs backend, frontend, and
  MCP checks).
- Describe what changed and why.
- **Sign off your commits** with `git commit -s` (see below).

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities — see
[`SECURITY.md`](SECURITY.md).

## Contribution terms

By contributing you agree to the project's [Contribution Terms](CONTRIBUTION_TERMS.md):
your contributions are licensed under the Apache License 2.0 (inbound = outbound),
and each commit must be signed off under the Developer Certificate of Origin —
add a `Signed-off-by` line with `git commit -s`. See
[`CONTRIBUTION_TERMS.md`](CONTRIBUTION_TERMS.md) for the full text.

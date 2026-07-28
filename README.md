# Floppy Disk

A **Google-Drive-style cloud storage app** — upload, organize, preview, and
share your files and folders, with self-hosted video playback. India-first,
single storage tier (no subscriptions).

> **Product focus:** Floppy Disk is a file-storage product. The earlier
> "media platform" features were dropped in the Drive-focus pivot — **Channels**
> were removed entirely, and the **third-party video streaming platform**
> (Cloudflare Stream) was replaced by **self-hosted transcoding**. See
> [`docs/deactivated-features.md`](docs/deactivated-features.md).

## Repository layout

```
.
├── frontend/              # React + Vite web app
│   ├── src/
│   │   ├── App.jsx        # container: state, handlers, API wiring, renderVals()
│   │   ├── view/AppView.jsx   # composition root
│   │   ├── components/   # AuthScreen, AppShell, FileCard/FileRow, TrashScreen,
│   │   │                 # and the modals (Upload, Preview, Video, Share,
│   │   │                 # Rename, Move, Links, Settings, …)
│   │   ├── lib/          # ui.js (helpers), markdown.js (renderer), theme.js
│   │   ├── api.js, main.jsx
│   │   └── **/*.test.js  # Vitest unit tests (lib helpers, markdown)
│   ├── e2e/              # Playwright end-to-end specs
│   └── package.json, vite.config.js, playwright.config.js, vitest.config.js
├── backend/               # Django + DRF API + Celery workers
│   └── apps/              # accounts, storage, sharing, notifications,
│                          # search, analytics, common
├── mcp/                   # Python FastMCP server wrapping the REST API
├── .github/workflows/ci.yml   # backend + frontend + MCP CI
└── docs/
    ├── PRD-02-Backend-Platform.md   # backend/platform spec
    ├── api/                         # OpenAPI spec + README
    └── deactivated-features.md      # what was removed/replaced in the pivot
```

## Features

Built test-first (pytest) with the frontend wired and Playwright end-to-end
coverage. **161 backend tests · 18 Vitest unit — all green**, plus Playwright
E2E specs for the main flows.

| Area | Endpoints (under `/api/v1/`) | Highlights |
|---|---|---|
| **Auth** | `auth/{register,login,logout,me,csrf,verify-email,password-reset}` | email/password behind `AuthProvider`; age≥18; session + CSRF |
| **Storage** | `storage/{folders,files,uploads,usage,trash}` | nested folders, per-region dedup, **reserve-then-commit quota**, presigned upload |
| **Rename / move** | `PATCH storage/{folders,files}/{id}` | rename + move (cycle-safe); **name-collision auto-suffix** `" (n)"` |
| **Trash** | `storage/{files,folders}/{id}/{restore,purge}`, `storage/trash` | soft-delete with **folder cascade**, restore-as-a-unit, ref-count release, retention job |
| **Viewers** | `storage/files/{id}/download` | inline **image / PDF / audio / Markdown / JSON / YAML / text** preview of your own files |
| **Video** | `storage/files/{id}/play` | **self-hosted** FFmpeg transcode → browser-playable MP4 + poster, served over HTTP Range (no third-party streaming) |
| **Sharing** | `storage/files/{id}/share`, `storage/shares`, `public/share/{token}` | public token links, expiry, optional password gate, **link management** (list/revoke) |
| **Notifications** | `notifications/…/{read,read-all}` | in-app notifications, unread counts |
| **Search** | `storage/search`, `storage/files/{id}/discoverable` | own + discoverable content; Postgres FTS (prod), portable (dev) |
| **Compliance** | `auth/account/{delete,export,consent,settings}` | DPDPA soft→hard delete, export, consent, backup settings |
| **Device backup** | `storage/camera-backup` | Camera Backup folder, quota-pause notify |

Rate limits (DRF scoped throttles) on login/register/password-reset/
share-unlock/verify-email/grievance.
Scheduled (Celery beat): trash purge, expired-reservation release, and 30-day
account hard-delete.

Service boundaries are abstracted for the vendor migration: `AuthProvider`
(Cognito), `StorageService` (R2/S3), `SearchService` (Postgres FTS/OpenSearch),
and `MediaTranscoder` (FFmpeg). Dev/test use in-process fakes
(`LocalStorageService`, `FakeTranscoder`) so the whole stack runs without
external credentials.

## Self-hosted video

Uploaded videos are normalized on our own servers with **FFmpeg** (installed in
the backend image): a background task probes each upload and, if it isn't
already browser-playable, transcodes an H.264/AAC MP4 rendition and grabs a
poster frame. Playback is served over the existing HTTP **Range** endpoint —
progressive download + native seeking, no CDN or streaming SaaS. The original
file is always kept alongside the rendition.

## Backend — run

```bash
cd backend
cp .env.example .env
docker compose up --build        # postgres + redis + web + worker + beat (image includes ffmpeg)
#   or locally:  python -m venv .venv && . .venv/bin/activate
#                pip install -r requirements-dev.txt && python manage.py migrate && python manage.py runserver
pytest                            # run the test suite
```

## Frontend — run

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run test:unit    # Vitest unit tests
npm run test:e2e     # Playwright E2E (boots backend on SQLite + Vite, drives Chromium)
```

`src/App.jsx` talks to the backend same-origin via the Vite dev proxy (`/api` →
`:8000`), so run the backend too.

## MCP server

`mcp/` is a Python [FastMCP](https://github.com/jlowin/fastmcp) server exposing
the REST API as MCP tools (folders, files, rename/move, upload/download,
sharing, video playback, notifications) for MCP-aware clients. See
[`mcp/README.md`](mcp/README.md).

## Stack

- **Backend:** Django + DRF, PostgreSQL, Celery + Redis
- **Storage:** Cloudflare R2 (S3-compatible) in prod; local disk in dev
- **Video:** self-hosted FFmpeg transcoding + HTTP Range delivery
- **Auth:** email/password via Django auth behind an `AuthProvider` abstraction
- **CI:** GitHub Actions — backend pytest, frontend build + unit + E2E, MCP smoke

See `docs/PRD-02-Backend-Platform.md` for the full specification.

## License

Copyright 2026 Kashyap Sri Datta M.
Licensed under the [Apache License 2.0](LICENSE) (see also [NOTICE](NOTICE)).

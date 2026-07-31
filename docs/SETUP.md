# Setup Guide

How to install and run **Floppy Disk** — your self-hosted, Google-Drive-style
cloud storage. Pick the path that matches you:

- [**A. Run it (self-host)**](#a-run-it-self-host) — one container, one command.
  Start here if you just want to use it.
- [**B. Develop on it**](#b-develop-on-it) — full dev stack with hot reload and
  tests.
- [**C. Connect an AI or automation**](#c-connect-an-ai-or-automation) — the MCP
  server and REST API.

Everything is open source (Apache-2.0) and runs without any paid third-party
service.

---

## A. Run it (self-host)

The whole product runs as a **single container** — no Redis, no separate
worker, no external database to set up. It uses SQLite and runs background jobs
(video transcode, periodic maintenance) in-process, all persisted in one Docker
volume.

### Prerequisites

- **Docker** with Compose (Docker Desktop, or Docker Engine + `docker compose`).
- ~2 GB free disk to build the image; more for your files.
- That's it — no database, no Redis, no API keys to sign up for.

### 1. Get the code

```bash
git clone https://github.com/dattamks/Floppy_Disk.git
cd Floppy_Disk
```

### 2. Start it

```bash
docker compose -f docker-compose.standalone.yml up --build
```

The first build compiles the frontend and installs the backend (a few minutes).
When you see gunicorn start, open:

```
http://localhost:8000
```

### 3. Create your account

On the login screen, choose **Register**, enter your email and a password
(you must be 18+), and sign in. That first account is yours — there's no
separate admin signup. Your files, folders, sharing, and the knowledge graph
all live under this account.

That's the whole install. Data persists in the `floppydata` Docker volume, so
you can stop and restart (`docker compose -f docker-compose.standalone.yml up`)
without losing anything. A secure `SECRET_KEY` is generated and stored on first
run — nothing to configure.

### 4. First steps in the app — a quick tour

Once you're in, here's the whole product in about a minute.

**Organize with folders.** Click **New folder** to create folders (they nest —
`Projects / Aurora`), and **Upload** to add files. Drag files in, or use the
button. Everything is yours and private by default.

![Your drive: folders and files](images/onboarding-01-drive.png)

**Open a folder** to see what's inside — documents, images, PDFs, videos, and
more, each with a preview thumbnail.

![Inside a folder](images/onboarding-02-folder.png)

**Preview anything in place.** Click a file to view it without downloading —
Markdown renders, and images, PDFs, audio, JSON/YAML, and text all preview
inline. Videos play in the browser (transcoded on your own server).

![Rendered Markdown preview](images/onboarding-03-preview.png)

**Take notes.** Click **New note** to start writing in a full-screen
**rich-text editor** — no Markdown syntax to learn. Use the toolbar (or the usual
shortcuts) for **bold**, headings, lists, and clickable checklists, and it
formats as you type. Switch between the **Write**, **Markdown**, and **Preview**
tabs whenever you like. Give it a title and **Save** (or `⌘/Ctrl+S`). Notes are
saved as plain `.md` files, so they live in folders, show up in full-text
search, and can be shared like anything else. Link one note to another with
`[[Note name]]`.

![The full-screen rich-text note editor with Write / Markdown / Preview tabs](images/onboarding-08-note-editor.png)

**Follow the links between notes.** Open a note and its **Linked mentions** panel
shows every other note that points to it — click through to jump around your
knowledge base. (These same links power the knowledge graph below.)

![A note's backlinks / linked mentions](images/onboarding-09-note-backlinks.png)

**Search across names _and_ contents.** The search box does full-text search —
type a word that lives *inside* your documents and every file that mentions it
comes back, not just files whose name matches.

![Full-text content search](images/onboarding-04-search.png)

**See how everything connects.** Open **Knowledge graph** for an interactive,
Obsidian-style map of your files: folders and files are nodes; edges show what
contains what and which documents reference each other. Filter by type, focus on
one file's neighborhood, or search within the graph. (Right-click any file →
**Related files** to jump straight to its connections.)

![Interactive knowledge graph](images/onboarding-05-graph.png)

**Share a file** with a public link in one click. Right-click → **Share** and a
link is minted instantly — copy it with the **Copy link** button. Add a password
or expiry, or manage/revoke links later under **Manage links**.

![One-click public share link](images/onboarding-06-share.png)

**Automate it (optional).** In **Settings → Developer**, mint an API key to drive
your storage from scripts or an AI assistant over the [MCP server](#c-connect-an-ai-or-automation).
Keep a key full-access, make it **read-only**, or **scope it to a single folder**
so an integration only ever sees that subtree — files, search, and graph included.

![API keys in the Developer tab](images/onboarding-07-devkeys.png)

### Run without Docker

If you'd rather run it directly (any Linux/macOS with Python 3.12 and Node 20):

```bash
# 1. build the SPA once
cd frontend && npm ci && npx vite build && cd ..

# 2. install the backend
cd backend && pip install -r requirements.txt

# 3. migrate and serve (SQLite + in-process jobs)
export DJANGO_SETTINGS_MODULE=config.settings.standalone
python manage.py migrate
python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

Then open `http://localhost:8000` and register as above.

> Background maintenance (trash purge, expired-reservation release, account
> hard-delete) runs automatically in-process while serving. To run it as a cron
> job instead, call `python manage.py maintenance`.

> **FFmpeg** powers self-hosted video transcoding. The Docker image installs it
> for you; for the no-Docker path, install `ffmpeg` on your system if you want
> video normalization (uploads still work without it).

---

### Configuration (optional)

Nothing is required. For a real deployment, set any of these as environment
variables (in `docker-compose.standalone.yml` under `environment:`, or your
shell for the no-Docker path):

| Variable | Default | What it does |
|---|---|---|
| `DJANGO_SECRET_KEY` | auto-generated + persisted in `/data` | Django secret. Set it to pin your own. |
| `ALLOWED_HOSTS` | `*` | Comma-separated hostnames for a public deploy, e.g. `files.example.com`. |
| `SECURE_SSL_REDIRECT` | `false` | Set `true` if you terminate TLS in front (reverse proxy / load balancer). |
| `DATABASE_URL` | SQLite in `/data` | Point at Postgres (`postgres://user:pass@host/db`) to use it instead. |
| `WEB_CONCURRENCY` | `3` | gunicorn worker processes. |
| `PORT` | `8000` | Port inside the container. |
| `MAINTENANCE_INTERVAL_SECONDS` | `3600` | How often in-process maintenance runs. |
| `DEFAULT_FROM_EMAIL` | `Floppy Disk <no-reply@floppy.disk>` | From address for verification / password-reset email. |
| `FRONTEND_BASE_URL` | the app's own origin | Base URL used in email links. |

Email verification and password-reset **links are printed to the container log**
by default (console email backend), which is fine for personal use. To send real
email, configure an SMTP backend via the standard Django email settings.

### Put it behind a domain (TLS)

Run a reverse proxy (Caddy, nginx, Traefik) in front, terminate TLS there, and
forward to the container's port 8000. Set `ALLOWED_HOSTS=your.domain` and
`SECURE_SSL_REDIRECT=true`. Example `docker-compose.standalone.yml` override:

```yaml
environment:
  ALLOWED_HOSTS: "files.example.com"
  SECURE_SSL_REDIRECT: "true"
  WEB_CONCURRENCY: "3"
```

### Health, data, and backups

- **Health check:** `GET http://localhost:8000/health/` returns `200` when the
  app is up (the container's Docker healthcheck uses this).
- **All data** — SQLite database, uploaded files, generated video renditions,
  the persisted secret key — lives in the `floppydata` volume mounted at `/data`.
- **Back up** by snapshotting that volume (stop the container first for a
  consistent copy), e.g.
  `docker run --rm -v floppydata:/data -v "$PWD":/backup alpine tar czf /backup/floppy-backup.tar.gz -C /data .`

### Upgrade

```bash
git pull
docker compose -f docker-compose.standalone.yml up --build
```

Migrations run automatically on startup. Your `/data` volume is untouched.

---

## B. Develop on it

For hacking on the code, the dev stack runs each piece separately with hot
reload. Full details (including tests and linting) are in
[`CONTRIBUTING.md`](../CONTRIBUTING.md); the short version:

**Backend** (Django API + Celery, on Postgres + Redis):

```bash
cd backend
cp .env.example .env          # then edit as needed
docker compose up --build     # postgres + redis + web + worker + beat (with ffmpeg)
#   or locally:
#   python -m venv .venv && source .venv/bin/activate
#   pip install -r requirements-dev.txt && python manage.py migrate && python manage.py runserver
pytest                        # run the backend test suite
```

**Frontend** (React + Vite dev server, proxies `/api` → `:8000`):

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
npm run test:unit             # Vitest unit tests
npm run test:e2e              # Playwright E2E (boots backend on SQLite + Vite)
```

See [`.env.example`](../backend/.env.example) for every backend setting
(Postgres/Redis, optional Cloudflare R2 storage, FFmpeg paths, email, quota).
Leave the R2 variables blank and storage automatically falls back to a local
media folder — no cloud account needed for development.

---

## C. Connect an AI or automation

Floppy Disk ships an **MCP server** so any MCP-aware client — Claude Code, n8n,
Codex/OpenAI, Claude Desktop — can do everything a user can: browse and manage
files, upload/download, share, read notifications, and query the knowledge
graph. It's a thin, authenticated wrapper over the same REST API.

Quick start:

1. **Mint an API key** on the backend (works for the standalone container too —
   `docker compose ... exec floppy python manage.py create_api_key you@example.com --name mcp`):

   ```bash
   cd backend
   python manage.py create_api_key you@example.com --name mcp
   # prints fd_xxxx… once — copy it. Add --read-only for a read-only key,
   # or mint a folder-scoped key via POST /api/v1/auth/api-keys {"root_folder": "<id>"}.
   ```

2. **Install and run** the server, then point your client at it. Full
   instructions, the env-var table, and ready-to-paste client configs
   (Claude Code / n8n / Codex) are in [`../mcp/README.md`](../mcp/README.md).

Prefer raw HTTP? The REST API is documented in
[`docs/api/`](api/) (OpenAPI spec + README). Authenticate with the same
`Authorization: Bearer fd_xxxx…` key.

---

## Troubleshooting

- **Port 8000 already in use** — change the left side of the port mapping in
  `docker-compose.standalone.yml` (e.g. `"9000:8000"`) and open that port.
- **`DisallowedHost` / 400 on a public domain** — set `ALLOWED_HOSTS` to your
  hostname.
- **Password-reset / verification email "not arriving"** — by default links are
  printed to the container log; check `docker compose -f docker-compose.standalone.yml logs`,
  or configure real SMTP.
- **Video won't play back** — ensure `ffmpeg` is available (the Docker image
  has it); the original upload is always kept even if transcoding is skipped.
- **"No space left on device"** — the `/data` volume filled up; free space or
  grow the volume. Uploads are quota-limited per account server-side.

Still stuck? Open an issue — and for anything security-related, follow
[`SECURITY.md`](../SECURITY.md) instead of filing a public issue.

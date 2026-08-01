# Setup Guide

How to install and run **Floppy Disk** - your self-hosted, Google-Drive-style
cloud storage. Pick the path that matches you:

- [**A. Run it (self-host)**](#a-run-it-self-host) - one container, one command.
  Start here if you just want to use it.
- [**B. Develop on it**](#b-develop-on-it) - full dev stack with hot reload and
  tests.
- [**C. Connect an AI or automation**](#c-connect-an-ai-or-automation) - the MCP
  server and REST API.

Everything is open source (Apache-2.0) and runs without any paid third-party
service.

---

## A. Run it (self-host)

The whole product runs as a **single container** - no Redis, no separate
worker, no external database to set up. It uses SQLite and runs background jobs
(video transcode, periodic maintenance) in-process, all persisted in one Docker
volume.

### Prerequisites

- **Docker** with Compose (Docker Desktop, or Docker Engine + `docker compose`).
- ~2 GB free disk to build the image; more for your files.
- That's it - no database, no Redis, no API keys to sign up for.

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
(you must be 18+), and sign in. That first account is yours - there's no
separate admin signup. Your files, folders, sharing, and the knowledge graph
all live under this account.

That's the whole install. Data persists in the `floppydata` Docker volume, so
you can stop and restart (`docker compose -f docker-compose.standalone.yml up`)
without losing anything. A secure `SECRET_KEY` is generated and stored on first
run - nothing to configure.

### 4. First steps in the app - a quick tour

Once you're in, here's the whole product in about a minute.

**Organize with folders.** Click **New folder** to create folders (they nest -
`Projects / Aurora`), and **Upload** to add files. Drag files in, or use the
button. Everything is yours and private by default.

![Your drive: folders and files](images/onboarding-01-drive.png)

**Open a folder** to see what's inside - documents, images, PDFs, videos, and
more, each with a preview thumbnail.

![Inside a folder](images/onboarding-02-folder.png)

**Preview anything in place.** Click a file to view it without downloading -
Markdown renders, and images, PDFs, audio, JSON/YAML, and text all preview
inline. Videos play in the browser (transcoded on your own server).

![Rendered Markdown preview](images/onboarding-03-preview.png)

**Take notes.** Click **New note** to start writing in a full-screen
**rich-text editor** - no Markdown syntax to learn. Use the toolbar (or the usual
shortcuts) for **bold**, headings, lists, and clickable checklists, and it
formats as you type. Switch between the **Write**, **Markdown**, and **Preview**
tabs whenever you like. Give it a title and **Save** (or `⌘/Ctrl+S`). Notes are
saved as plain `.md` files, so they live in folders, show up in full-text
search, and can be shared like anything else. Link one note to another with
`[[Note name]]`.

![The full-screen rich-text note editor with Write / Markdown / Preview tabs](images/onboarding-08-note-editor.png)

**Follow the links between notes.** Open a note and its **Linked mentions** panel
shows every other note that points to it - click through to jump around your
knowledge base. (These same links power the knowledge graph below.)

![A note's backlinks / linked mentions](images/onboarding-09-note-backlinks.png)

**Search across names _and_ contents.** The search box does full-text search -
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
link is minted instantly - copy it with the **Copy link** button. Add a password
or expiry, or manage/revoke links later under **Manage links**.

![One-click public share link](images/onboarding-06-share.png)

**Automate it (optional).** In **Settings → Developer**, mint an API key to drive
your storage from scripts or an AI assistant over the [MCP server](#c-connect-an-ai-or-automation).
Keep a key full-access, make it **read-only**, or **scope it to a single folder**
so an integration only ever sees that subtree - files, search, and graph included.

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
| `SECURE_SSL_REDIRECT` | `false` | Redirect http → https. Set `true` for a public HTTPS deploy. |
| `USE_PROXY_SSL_HEADER` | `false` | Trust the reverse proxy's `X-Forwarded-Proto`. Enable when TLS is terminated by a proxy in front (required with `SECURE_SSL_REDIRECT`). |
| `DATABASE_URL` | SQLite in `/data` | Point at Postgres (`postgres://user:pass@host/db`) to use it instead. |
| `R2_ENDPOINT_URL` | _(empty → local disk)_ | Cloudflare R2 S3 endpoint, e.g. `https://<account-id>.r2.cloudflarestorage.com`. Setting the R2 vars auto-switches storage to R2 (see [Where your files live](#where-your-files-live-storage)). |
| `R2_ACCESS_KEY_ID` | _(empty)_ | R2 access key ID (R2 API token). |
| `R2_SECRET_ACCESS_KEY` | _(empty)_ | R2 secret access key. |
| `R2_BUCKET` | _(empty)_ | Your R2 bucket name. One bucket is all a self-host needs. |
| `STORAGE_QUOTA_BYTES` | `0` (auto) | Storage ceiling shown in the sidebar meter and enforced on upload. `0` = auto: the per-user quota, but on local storage capped to the real disk size. Set a byte count to pin a fixed quota for everyone (e.g. `107374182400` = 100 GB). |
| `STORAGE_TRACK_DISK` | `true` | On local storage, track the real disk: the quota follows the disk size and uploads are refused once the disk is physically full. Set `false` to use the plain per-user quota. |
| `WEB_CONCURRENCY` | `3` | gunicorn worker processes. |
| `PORT` | `8000` | Port inside the container. |
| `MAINTENANCE_INTERVAL_SECONDS` | `3600` | How often in-process maintenance runs. |
| `DEFAULT_FROM_EMAIL` | `Floppy Disk <no-reply@floppy.disk>` | From address for verification / password-reset email. |
| `FRONTEND_BASE_URL` | the app's own origin | Base URL used in email links. |

Email verification and password-reset **links are printed to the container log**
by default (console email backend), which is fine for personal use.

#### Send real email (SMTP)

To actually deliver email, set your mail provider's SMTP variables. **Just
setting `EMAIL_HOST` switches on SMTP** - no other backend setting needed. Add
these under `environment:` in `docker-compose.standalone.yml` (or export them for
the no-Docker run):

| Variable | Example | Meaning |
|---|---|---|
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP server hostname (**setting this enables SMTP**) |
| `EMAIL_PORT` | `587` | SMTP port. `587` for TLS (default), `465` for SSL |
| `EMAIL_HOST_USER` | `you@gmail.com` | SMTP username |
| `EMAIL_HOST_PASSWORD` | `app-password` | SMTP password (use an app password, not your login) |
| `EMAIL_USE_TLS` | `true` | STARTTLS on port 587 (default `true`) |
| `EMAIL_USE_SSL` | `false` | SSL on port 465 (set `true` **and** `EMAIL_USE_TLS=false` for 465) |
| `DEFAULT_FROM_EMAIL` | `Floppy Disk <no-reply@you.com>` | The "From" address on outgoing mail |

Example (TLS, e.g. Gmail / most providers):

```yaml
environment:
  EMAIL_HOST: "smtp.gmail.com"
  EMAIL_PORT: "587"
  EMAIL_HOST_USER: "you@gmail.com"
  EMAIL_HOST_PASSWORD: "your-app-password"
  EMAIL_USE_TLS: "true"
  DEFAULT_FROM_EMAIL: "Floppy Disk <you@gmail.com>"
  FRONTEND_BASE_URL: "https://files.example.com"   # so links point at your app
```

For an SSL provider on port 465, instead set `EMAIL_PORT: "465"`,
`EMAIL_USE_SSL: "true"`, and `EMAIL_USE_TLS: "false"`. Restart the container after
changing these. (Gmail needs an **App Password** - enable 2-Step Verification,
then create one under your Google account's *App passwords*.)

### Forgot your password?

There are two ways to recover an account:

1. **Reset link (self-service).** On the sign-in screen, click **Forgot
   password?**, enter your email, and open the reset link. With SMTP configured
   the link is emailed; on a default self-host it's **printed to the container
   log** - grab it there:

   ```bash
   docker compose -f docker-compose.standalone.yml logs | grep reset-password
   ```

   Open that URL, choose a new password, and sign in.

2. **From the command line (no email needed).** The admin can reset any
   account's password directly - the reliable fallback when SMTP isn't set up or
   you've locked yourself out:

   ```bash
   docker compose -f docker-compose.standalone.yml exec floppy \
     python manage.py set_password you@example.com
   # (prompts for the new password; add --password '…' to script it)
   ```

   Without Docker, run the same `python manage.py set_password …` from the
   `backend/` directory.

### Put it behind a domain (TLS / HTTPS)

The app doesn't terminate TLS itself - run a reverse proxy (Caddy, nginx,
Traefik) or a platform in front that does HTTPS, and forward to the container's
port 8000. Because TLS ends at the proxy, tell the app to trust the proxy's
`X-Forwarded-Proto` header (`USE_PROXY_SSL_HEADER`) - **without it,
`SECURE_SSL_REDIRECT` causes a redirect loop.** Example
`docker-compose.standalone.yml` override:

```yaml
environment:
  ALLOWED_HOSTS: "files.example.com"
  USE_PROXY_SSL_HEADER: "true"   # trust the proxy's HTTPS (enable behind a TLS proxy)
  SECURE_SSL_REDIRECT: "true"    # redirect any http → https
  SESSION_COOKIE_SECURE: "true"  # cookies only over https
  CSRF_COOKIE_SECURE: "true"
  # SECURE_HSTS_SECONDS: "31536000"  # optional: enforce HTTPS for 1 year (set once HTTPS is solid)
  WEB_CONCURRENCY: "3"
```

(Caddy is the simplest: a two-line `Caddyfile` - `files.example.com { reverse_proxy localhost:8000 }` - gets you an auto-renewing Let's Encrypt certificate.)

### Security & encryption

- **In transit:** all traffic - the web app, the REST API, **and MCP** - is
  encrypted whenever you run behind HTTPS as above. MCP/API clients authenticate
  with a **Bearer key over that same TLS**, so an AI assistant's requests are
  encrypted end-to-end to your proxy.
- **Secrets at rest:** account passwords are hashed (PBKDF2-SHA256), API/MCP keys
  are stored only as a **SHA-256 hash** (the raw key is shown once and never
  stored), and share-link passwords are hashed too. None of these are recoverable
  from the database.
- **File contents & database at rest:** stored as-is - the app does not encrypt
  file bytes or the database itself. For encryption at rest, put the `floppydata`
  volume on an **encrypted disk/volume** (LUKS, cloud encrypted EBS/PD, etc.), or
  point `DATABASE_URL` at a managed Postgres with encryption on. If you use
  Cloudflare R2/S3 for storage, enable that bucket's server-side encryption.
- **Least-privilege for AI/automation:** give an integration a **read-only** key,
  or a **folder-scoped** key confined to one subtree (files, search, and the
  knowledge graph all stay within it) - so an MCP/AI client only ever sees what
  you intend. Treat keys like passwords and revoke unused ones.

### Where your files live (storage)

Storage is chosen automatically, the same way the database is: **if you give it
Cloudflare R2, it uses R2; otherwise it stores files on local disk.** Nothing to
toggle - just set (or don't set) the R2 variables.

> **No terminal required.** The **first account you register becomes the Owner**.
> On first sign-in the app asks where files should live, and **Settings →
> Storage** lets the Owner paste R2 credentials, **Test** the connection, save
> (no restart), and **move existing local files to R2** with one click - all
> from the browser. The environment variables below are the equivalent for
> operators who prefer config-as-code; if they're set, the in-app screen shows
> them read-only. Everything in this section describes that operator path.

**Option 1 - Cloudflare R2 (recommended; no server disk needed).** Files go
straight to R2 object storage: durable, scalable, and independent of the
container's disk. Set four variables and R2 switches on:

| Variable | Where to get it |
|---|---|
| `R2_ENDPOINT_URL` | Cloudflare dashboard → R2 → *your bucket* → **S3 API** endpoint, e.g. `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 → **Manage API Tokens** → create a token → Access Key ID |
| `R2_SECRET_ACCESS_KEY` | …the matching Secret Access Key (shown once) |
| `R2_BUCKET` | The bucket name you created |

```yaml
    environment:
      R2_ENDPOINT_URL: "https://<account-id>.r2.cloudflarestorage.com"
      R2_ACCESS_KEY_ID: "<access-key-id>"
      R2_SECRET_ACCESS_KEY: "<secret-access-key>"
      R2_BUCKET: "my-floppy-bucket"
```

On boot the log confirms the backend (`[storage] Durable object storage
backend: …r2.R2StorageService`). Uploads/downloads use time-limited **presigned
URLs** direct to R2, so the app server never proxies file bytes. For
encryption at rest, turn on the bucket's server-side encryption in Cloudflare.

**Option 2 - Local disk (default; only as durable as its volume).** With the R2
variables unset, files are written under `/data/storage` in the `floppydata`
volume. ⚠️ **This is durable only if that path is a persistent volume.** On many
hosts (ephemeral PaaS dynos/containers) the filesystem is wiped on every restart
or redeploy - your uploads would vanish. The app makes this loud: `manage.py
check` and the boot log emit a warning (`storage.W001`) whenever local storage
is active, telling you to attach a persistent volume or configure R2. Use local
disk only when you've mounted real persistent storage (the `floppydata` Docker
volume in the default compose file is persistent); otherwise use R2.

**Already have files on local disk? Migrate them to R2.** After adding the R2
variables and restarting, new uploads go to R2, but files already on the local
volume stay there (and would fail to download, since the app now looks in R2).
Move them across with one command - it's idempotent and resumable, copies each
deduplicated blob once, and never deletes anything unless you ask:

```bash
# preview what would move
docker compose -f docker-compose.standalone.yml exec floppy \
    python manage.py migrate_storage_to_r2 --dry-run

# do it (add --delete-local to reclaim disk after each verified upload)
docker compose -f docker-compose.standalone.yml exec floppy \
    python manage.py migrate_storage_to_r2
```

Re-run it any time - blobs already in R2 are skipped, so an interrupted run just
picks up where it left off.

### Health, data, and backups

- **Health check:** `GET http://localhost:8000/health/` returns `200` when the
  app is up (the container's Docker healthcheck uses this).
- **All data** - SQLite database, the persisted secret key, and (on the local
  backend) uploaded files + video renditions - lives in the `floppydata` volume
  mounted at `/data`. With **R2** configured, file bytes live in your R2 bucket
  instead; the volume then holds just the database and secret.
- **Back up** by snapshotting that volume (stop the container first for a
  consistent copy), e.g.
  `docker run --rm -v floppydata:/data -v "$PWD":/backup alpine tar czf /backup/floppy-backup.tar.gz -C /data .`

**Storage meter looks wrong?** The used/total figure in the sidebar is a fast
counter kept in step with uploads and deletes. If it ever drifts (e.g. after an
interrupted job or a manual DB edit), recompute it from the actual files:

```
python manage.py recompute_storage_usage --dry-run   # report drift only
python manage.py recompute_storage_usage             # fix it
# containerized:
docker compose -f docker-compose.standalone.yml exec floppy \
    python manage.py recompute_storage_usage
```

The **total** in the meter reflects the real disk on local storage (not a flat
number); tune or pin it with `STORAGE_QUOTA_BYTES` / `STORAGE_TRACK_DISK` above.

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
media folder - no cloud account needed for development.

---

## C. Connect an AI or automation

Floppy Disk ships an **MCP server** so any MCP-aware client - Claude Code, n8n,
Codex/OpenAI, Claude Desktop - can do everything a user can: browse and manage
files, upload/download, share, read notifications, and query the knowledge
graph. It's a thin, authenticated wrapper over the same REST API.

Quick start:

1. **Mint an API key** on the backend (works for the standalone container too -
   `docker compose ... exec floppy python manage.py create_api_key you@example.com --name mcp`):

   ```bash
   cd backend
   python manage.py create_api_key you@example.com --name mcp
   # prints fd_xxxx… once - copy it. Add --read-only for a read-only key,
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

- **Port 8000 already in use** - change the left side of the port mapping in
  `docker-compose.standalone.yml` (e.g. `"9000:8000"`) and open that port.
- **`DisallowedHost` / 400 on a public domain** - set `ALLOWED_HOSTS` to your
  hostname.
- **Password-reset / verification email "not arriving"** - by default links are
  printed to the container log; check `docker compose -f docker-compose.standalone.yml logs`,
  or configure real SMTP. Locked out entirely? Reset from the CLI:
  `… exec floppy python manage.py set_password you@example.com` (see
  [Forgot your password?](#forgot-your-password)).
- **Video won't play back** - ensure `ffmpeg` is available (the Docker image
  has it); the original upload is always kept even if transcoding is skipped.
- **"No space left on device"** - the `/data` volume filled up; free space or
  grow the volume. Uploads are quota-limited per account server-side.

Still stuck? Open an issue - and for anything security-related, follow
[`SECURITY.md`](../SECURITY.md) instead of filing a public issue.

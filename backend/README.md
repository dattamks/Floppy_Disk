# Floppy Disk - Backend

Django + DRF API, Celery workers, PostgreSQL, Redis. Object storage on
Cloudflare R2 (S3-compatible) in prod, local disk in dev; self-hosted FFmpeg
video transcoding. See [`../docs/api/`](../docs/api) for the API reference.

## Layout

```
backend/
├── config/                 # Django project
│   ├── settings/           # base.py + local.py + production.py (env-driven)
│   ├── celery.py           # Celery app
│   ├── urls.py             # /admin, /health, (api routes mounted per-app)
│   └── wsgi.py / asgi.py
├── apps/
│   ├── common/             # base models (UUID/timestamps) + /health
│   ├── accounts/           # custom email User, UserDevice, AuthProvider
│   │   └── providers/      # AuthProvider interface + DjangoAuthProvider (Phase 1)
│   ├── storage/            # StorageObject/File/Folder (+ StorageService → R2)
│   ├── sharing/            # ShareLink / SharePermission / copy-on-share
│   ├── notifications/      # Notification + Celery dispatch
│   ├── analytics/          # AnalyticsEvent (JSONB, partitioned)
│   └── search/             # SearchService → Postgres FTS (OpenSearch later)
├── requirements.txt        # runtime deps (pip)
├── requirements-dev.txt    # + test/lint
├── Dockerfile
└── docker-compose.yml      # postgres + redis + web + worker + beat
```

## Architecture notes

- **Service abstractions** decouple the app from vendors so migrations are config-only:
  `AuthProvider` (Django auth → Cognito), `StorageService` (R2 → S3),
  `SearchService` (Postgres FTS → OpenSearch). Each is chosen via a
  settings string and instantiated through a `get_*()` helper.
- **Auth is email/password** (behind the `AuthProvider` abstraction); phone/OTP +
  social are future work (fields exist but inert).
- **Storage backends:** `LocalStorageService` (local disk) is fully implemented
  and is the default when R2 isn't configured. `R2StorageService` is a stub -
  wiring the boto3 calls is the main task before a cloud deployment.

## Run (Docker - recommended)

```bash
cp .env.example .env
docker compose up --build
# API:    http://localhost:8000/health/
# Admin:  http://localhost:8000/admin/   (create a superuser first, below)
docker compose exec web python manage.py createsuperuser
```

## Run (local venv)

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                     # point DATABASE_URL at a local Postgres
python manage.py migrate
python manage.py runserver
```

## Tests

```bash
pytest
```

# Floppy Disk — Backend

Django + DRF API, Celery workers, PostgreSQL, Redis. Object storage / video /
CDN via Cloudflare (R2 + Stream). See `../docs/PRD-02-Backend-Platform.md` for
the full specification.

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
│   ├── channels/           # Channel / membership / posts
│   ├── billing/            # Subscription/Invoice/ReferralBonus (+ PaymentGateway → Razorpay)
│   ├── moderation/         # ContentReport/Flag/CSAMIncident, quarantine
│   ├── notifications/      # Notification + Celery dispatch
│   ├── analytics/          # AnalyticsEvent (JSONB, partitioned)
│   └── search/             # SearchService → Postgres FTS (OpenSearch later)
├── requirements.txt        # runtime deps (pip)
├── requirements-dev.txt    # + test/lint
├── Dockerfile
└── docker-compose.yml      # postgres + redis + clamav + web + worker + beat
```

## Architecture notes

- **Service abstractions** decouple the app from vendors so migrations are config-only:
  `AuthProvider` (Django auth → Cognito), `StorageService` (R2 → S3), `PaymentGateway`
  (Razorpay → Stripe), `SearchService` (Postgres FTS → OpenSearch). Each is chosen via a
  settings string and instantiated through a `get_*()` helper.
- **Auth is Phase 1 = email/password**; phone/OTP + social are Phase 2 (fields exist but inert).
- **Foundation pass:** models exist for accounts only; other apps are registered skeletons.
  Service methods raise `NotImplementedError` where a build slice will wire them.

## Run (Docker — recommended)

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

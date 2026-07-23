# Floppy Disk

General-purpose cloud storage / sharing / streaming application — upload, organize, share, and stream files and video. India-first, ad-supported free tier, paid subscription tiers.

## Repository layout

```
.
├── frontend/              # React + Vite web app (the UI we build on)
│   ├── index.html
│   ├── src/               # App.jsx (demo UI, localStorage-backed), main.jsx, index.css
│   ├── package.json
│   └── vite.config.js
├── backend/               # Django + DRF API + Celery workers
│   └── apps/              # accounts, storage, sharing, channels, billing,
│                          # moderation, notifications, search, analytics, common
└── docs/
    ├── PRD-02-Backend-Platform.md   # Backend/platform spec (authoritative)
    └── design-reference/            # Design-tool export + PRD-01 (reference only, not built)
```

## Implemented so far (Phase 1)

Each feature is built test-first (pytest) with the frontend wired and a Playwright
end-to-end test. **110 backend unit tests + 13 E2E, all green.**

| Area | Endpoints (under `/api/v1/`) | Highlights |
|---|---|---|
| **Auth** | `auth/{register,login,logout,me,csrf,verify-email,password-reset}` | email/password behind `AuthProvider`; age≥18; session + CSRF |
| **Storage** | `storage/{folders,files,uploads,usage,trash}` | per-region dedup, **reserve-then-commit quota**, presigned upload |
| **Trash** | `storage/files/{id}/{restore,purge}`, `storage/trash` | soft-delete, ref-count release, retention job |
| **Sharing** | `storage/files/{id}/share`, `public/share/{token}` | public token links, expiry, paid password gate |
| **Channels** | `channels/…/{subscribe,posts,promote}` | owner/admin/subscriber roles, role-gated posting |
| **Moderation** | `moderation/reports` | malware scan on upload (quarantine), Flag/Report |
| **Billing** | `billing/{plans,subscribe,cancel,webhook}` | tier+quota upgrades, idempotent webhooks, expiry-anchored freeze lifecycle |
| **Video** | `storage/files/{id}/{play,promote}`, `storage/stream/webhook` | private→R2 signed, promoted→HLS, free-tier SD cap |
| **Referrals** | `billing/referral{,/apply}` | 50GB/referral, 1TB cap, 180d expiry, effective quota |
| **Notifications** | `notifications/…/{read,read-all}` | channel fan-out, unread counts |
| **Compliance** | `auth/account/{delete,export,consent}` | DPDPA soft→hard delete (legal hold), data export, consent log |

Rate limits (DRF scoped throttles) on login/register/password-reset/report/share-unlock.
Scheduled (Celery beat): trash purge, expired-reservation release, subscription
freeze lifecycle, and 30-day account hard-delete.

Service boundaries are abstracted for the AWS/vendor migration: `AuthProvider`
(Cognito), `StorageService` (R2/S3), `PaymentGateway` (Razorpay/Stripe),
`VideoService` (Cloudflare Stream), `SearchService` (Postgres FTS/OpenSearch),
`ScanService` (ClamAV). Dev/test use in-process fakes (`LocalStorageService`,
`FakePaymentGateway`, `FakeScanService`, `FakeVideoService`) so the whole stack
runs without external credentials.

## Backend — run

```bash
cd backend
cp .env.example .env
docker compose up --build        # postgres + redis + clamav + web + worker + beat
#   or locally:  python -m venv .venv && . .venv/bin/activate
#                pip install -r requirements-dev.txt && python manage.py migrate && python manage.py runserver
pytest                            # run the test suite
```

## Stack

- **Backend:** Django + DRF, PostgreSQL, Celery + Redis
- **Storage / video / CDN:** Cloudflare R2 + Stream + edge (env-var driven)
- **Auth (Phase 1):** email/password via Django auth, behind an `AuthProvider` abstraction (Cognito + phone/OTP in Phase 2)
- **Payments:** Razorpay behind a `PaymentGateway` abstraction
- **POC hosting:** Railway → AWS ECS Fargate + RDS post-validation

See `docs/PRD-02-Backend-Platform.md` for the full specification, phasing, and open decisions.

## Frontend — run

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

`src/App.jsx` talks to the backend same-origin via the Vite dev proxy (`/api` →
`:8000`), so run the backend too. Auth, files/folders, upload, trash, sharing,
channels, upgrade, and notifications are wired to the real API; remaining demo
areas still use mock data.

## End-to-end tests

```bash
cd frontend && npx playwright test    # boots backend (SQLite) + Vite, drives Chromium
```

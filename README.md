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
├── backend/               # Django + DRF API + Celery workers   (to be scaffolded)
└── docs/
    ├── PRD-02-Backend-Platform.md   # Backend/platform spec (authoritative)
    └── design-reference/            # Design-tool export + PRD-01 (reference only, not built)
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

The current `src/App.jsx` is the demo UI with mock data persisted to `localStorage`. It will be progressively wired to the backend API.

# Floppy Disk — API Reference

The authoritative, machine-readable contract is **[`openapi.yaml`](./openapi.yaml)**
(OpenAPI 3.1 — 55 operations). This page is the human-readable companion: the
model, conventions, and a per-area endpoint index. For exact field-level request
/response schemas, see the spec (render it with Swagger UI / Redoc, or paste into
[editor.swagger.io](https://editor.swagger.io)).

## Base URL & versioning
All application endpoints live under **`/api/v1/`**. `/health/` sits outside it.
In dev the SPA calls the backend same-origin through the Vite proxy.

## Authentication
Phase 1 is **session-based**:

1. `GET /api/v1/auth/csrf` once → sets the `csrftoken` cookie.
2. `POST /api/v1/auth/login` `{email, password}` → sets the `sessionid` cookie.
3. For every unsafe method (POST/PUT/PATCH/DELETE) on an authenticated endpoint,
   send the CSRF token back in the **`X-CSRFToken`** header (value = `csrftoken`
   cookie). GET requests need no CSRF.

Programmatic clients (the MCP server, integrations) authenticate with an
**API key**: `Authorization: Bearer <key>` — which bypasses CSRF.

Unauthenticated endpoints: `register`, `login`, `csrf`, `password-reset*`,
`verify-email`, `public/share/*`, the Stream/Razorpay webhooks, and `health`.

## Conventions
- **IDs** are UUIDs, except channel `handle` and share `token` (strings).
- **Sizes** are bytes; **money** is paise (₹1 = 100 paise).
- **Errors**: `{ "detail": "…", "code": "…" }`. `detail` may be a string or a
  list (field validation). `code` appears on typed errors (`quota_exceeded`,
  `file_too_large`, `scan_failed`, `paid_only`, `stream_unavailable`).
- **Rate limits** (429): login & password-reset 10/day, register 20/day, report
  10/hour, share-unlock 10/day.

## Upload flow (3 steps)
```bash
# 1) initiate — reserves quota, returns a presigned target
curl -X POST /api/v1/storage/uploads -H "X-CSRFToken: $CSRF" -b cookies \
  -d '{"name":"cat.jpg","size_bytes":12345,"kind":"image"}'
# -> { file:{id,…}, reservation_id, upload:{ url, object_key } }

# 2) PUT the raw bytes to upload.url
curl -X PUT "<upload.url>" --data-binary @cat.jpg -H "X-CSRFToken: $CSRF" -b cookies

# 3) complete — malware scan, dedup, commit quota
curl -X POST /api/v1/storage/uploads/<file_id>/complete -H "X-CSRFToken: $CSRF" -b cookies
# -> File (status: ready)   |   422 {code: scan_failed} if the scan blocks it
```

## Endpoint index

### Auth — `/api/v1/auth`
| Method | Path | Auth | Summary |
|---|---|---|---|
| POST | `/register` | – | Email/password signup (18+); logs in |
| POST | `/login` | – | Log in |
| POST | `/logout` | ✓ | Log out |
| GET | `/me` | ✓ | Current user (incl. `tier`, `billing_enabled`) |
| GET | `/csrf` | – | Prime the CSRF cookie |
| POST | `/password-reset` | – | Request reset (no enumeration) |
| POST | `/password-reset/confirm` | – | Confirm reset |
| POST | `/verify-email` | – | Verify email token |

### Account — `/api/v1/auth/account`
| Method | Path | Summary |
|---|---|---|
| POST | `/delete` | Soft-delete (hard-deletes after 30d) |
| POST | `/export` | DPDPA data export (expiring link) |
| POST | `/consent` | Record ToS/policy acceptance |
| GET / PATCH | `/settings` | Device-backup settings |

### Storage — `/api/v1/storage`
| Method | Path | Summary |
|---|---|---|
| GET | `/usage` | Usage + effective quota (incl. referral bonuses) |
| GET / POST | `/folders` | List (by `?parent=`) / create |
| DELETE | `/folders/{id}` | Soft-delete folder |
| POST | `/folders/{id}/restore` | Restore folder |
| GET | `/camera-backup` | Get/create the Camera Backup folder |
| GET | `/files` | List files (by `?folder=`) |
| DELETE | `/files/{id}` | Soft-delete file |
| POST | `/files/{id}/restore` | Restore file |
| POST | `/files/{id}/purge` | Permanently delete |
| POST | `/files/{id}/discoverable` | Toggle discoverable / mature |
| GET | `/trash` | List trashed folders + files |
| GET | `/search?q=` | Own + discoverable non-mature files |
| POST | `/uploads` | Initiate upload (step 1) |
| POST | `/uploads/{id}/complete` | Complete upload (step 3) |

### Video — `/api/v1/storage`
| Method | Path | Summary |
|---|---|---|
| POST | `/files/{id}/play` | Playback descriptor (`r2` direct / `hls`) |
| POST | `/files/{id}/promote` | Promote to Stream (HD/HLS) — 503 if unconfigured |
| POST | `/stream/webhook` | Stream processing callback (idempotent) |

### Sharing — `/api/v1/storage` & `/api/v1/public`
| Method | Path | Summary |
|---|---|---|
| POST | `/storage/files/{id}/share` | Create public link (password = paid) |
| GET | `/storage/shares` | List my links |
| DELETE | `/storage/shares/{id}` | Revoke |
| GET | `/public/share/{token}` | Resolve (no auth); 410 if expired/revoked |
| POST | `/public/share/{token}` | Unlock a password-protected link |

### Channels — `/api/v1/channels`
| Method | Path | Summary |
|---|---|---|
| GET / POST | `/` | Discover (`?mine=1`) / create |
| POST / DELETE | `/{id}/subscribe` | Subscribe / unsubscribe |
| POST | `/{id}/members/{user_id}/promote` | Promote to admin (owner only) |
| GET / POST | `/{id}/posts` | List / post (owner+admin only) |

### Moderation — `/api/v1/moderation`
| Method | Path | Summary |
|---|---|---|
| POST | `/reports` | Flag / Report (Report isolates a file) |

### Billing — `/api/v1/billing`
| Method | Path | Summary |
|---|---|---|
| GET | `/plans` | Plan catalog |
| POST | `/subscribe` | Subscribe (upgrades tier + quota) |
| GET | `/subscription` | Current subscription |
| POST | `/cancel` | Cancel (access to period end) |
| POST | `/webhook` | Razorpay webhook (idempotent) |
| GET | `/referral` | My referral code + stats |
| POST | `/referral/apply` | Apply a code (referrer gets 50GB) |

### Notifications — `/api/v1/notifications`
| Method | Path | Summary |
|---|---|---|
| GET | `/` | List + `unread_count` |
| POST | `/{id}/read` | Mark one read |
| POST | `/read-all` | Mark all read |

### Ops
| Method | Path | Summary |
|---|---|---|
| GET | `/health/` | Liveness/readiness (`{status, database}`) |

# Floppy Disk — API Reference

The authoritative, machine-readable contract is **[`openapi.yaml`](./openapi.yaml)**
(OpenAPI 3.1 — 59 operations). This page is the human-readable companion: the
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
- **IDs** are UUIDs, except share `token` (a string).
- **Sizes** are bytes.
- **Errors**: `{ "detail": "…", "code": "…" }`. `detail` may be a string or a
  list (field validation). `code` appears on typed errors (`quota_exceeded`,
  `file_too_large`).
- **Rate limits** (429): login & password-reset 10/day, register 20/day,
  share-unlock 10/day.

## Upload flow (3 steps)
```bash
# 1) initiate — reserves quota, returns a presigned target
curl -X POST /api/v1/storage/uploads -H "X-CSRFToken: $CSRF" -b cookies \
  -d '{"name":"cat.jpg","size_bytes":12345,"kind":"image"}'
# -> { file:{id,…}, reservation_id, upload:{ url, object_key } }

# 2) PUT the raw bytes to upload.url
curl -X PUT "<upload.url>" --data-binary @cat.jpg -H "X-CSRFToken: $CSRF" -b cookies

# 3) complete — dedup, commit quota
curl -X POST /api/v1/storage/uploads/<file_id>/complete -H "X-CSRFToken: $CSRF" -b cookies
# -> File (status: ready)   |   video -> status: processing (transcode)
```

## Endpoint index

### Auth — `/api/v1/auth`
| Method | Path | Auth | Summary |
|---|---|---|---|
| POST | `/register` | – | Email/password signup (18+); logs in |
| POST | `/login` | – | Log in |
| POST | `/logout` | ✓ | Log out |
| GET | `/me` | ✓ | Current user (incl. `quota_bytes`) |
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
| GET / POST | `/api-keys` | List / create Bearer API keys (secret shown once; `read_only` for least-privilege) |
| DELETE | `/api-keys/{id}` | Revoke a key |

### Storage — `/api/v1/storage`
| Method | Path | Summary |
|---|---|---|
| GET | `/usage` | Usage + storage quota |
| GET / POST | `/folders` | List (by `?parent=`) / create |
| DELETE | `/folders/{id}` | Soft-delete folder |
| POST | `/folders/{id}/restore` | Restore folder |
| GET | `/camera-backup` | Get/create the Camera Backup folder |
| GET | `/files` | List files (by `?folder=`) |
| GET | `/files/{id}/download` | URL to fetch the bytes (presigned R2 / direct local) |
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
| POST | `/files/{id}/play` | Direct URL to play your own video inline (`mode: direct`, plus `poster`/`duration_seconds`) |

> Videos are transcoded to a browser-playable MP4 **server-side with FFmpeg**
> (self-hosted, no third-party streaming) and served over the Range endpoint;
> `play` returns `409 {code: processing}` while a transcode is running.
> **Channels** and the old **Cloudflare Stream** integration were removed in the
> Drive-focus pivot — see [`../deactivated-features.md`](../deactivated-features.md).

### Sharing — `/api/v1/storage` & `/api/v1/public`
| Method | Path | Summary |
|---|---|---|
| POST | `/storage/files/{id}/share` | Create public link (optional password) |
| GET | `/storage/shares` | List my links |
| DELETE | `/storage/shares/{id}` | Revoke |
| GET | `/public/share/{token}` | Resolve (no auth); 410 if expired/revoked |
| POST | `/public/share/{token}` | Unlock a password-protected link |
| GET | `/public/share/{token}/download` | Download the bytes (no account; `?password=` for locked links) |


### Notifications — `/api/v1/notifications`
| Method | Path | Summary |
|---|---|---|
| GET | `/` | List + `unread_count` |
| POST | `/{id}/read` | Mark one read |
| POST | `/read-all` | Mark all read |

### Legal — `/api/v1/legal`
| Method | Path | Summary |
|---|---|---|
| GET | `/` | Policy versions + grievance officer contact (public) |
| POST | `/grievance` | File a grievance (IT Rules 2021 redressal); returns a ticket |

### Ops
| Method | Path | Summary |
|---|---|---|
| GET | `/health/` | Liveness/readiness (`{status, database}`) |

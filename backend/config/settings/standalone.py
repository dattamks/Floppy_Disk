"""
Standalone (single-deployment) settings.

Run the ENTIRE product as ONE process - no Redis, no separate Celery worker or
beat, no external Postgres required:

* **SQLite by default** (point DATABASE_URL at Postgres if you'd rather).
* **Background jobs run in-process** (Celery eager) - no broker.
* **Periodic maintenance** runs on a lightweight in-process thread (see
  apps.common.apps), replacing Celery beat.
* **Django serves the built SPA** (frontend/dist) at the root, so a single
  server delivers both the API and the app.
* **A persistent SECRET_KEY is generated on first run** and stored under the
  data dir, so nothing needs configuring for sessions to survive restarts.

Everything persists under one directory (FLOPPY_DATA_DIR) - bind-mount that and
the whole instance is durable. This is the recommended way to self-host.
"""
from pathlib import Path

from .base import *  # noqa: F401,F403
from .base import BASE_DIR, env

DEBUG = env.bool("DJANGO_DEBUG", default=False)

# One directory holds the database, blobs, and the secret key.
DATA_DIR = Path(env("FLOPPY_DATA_DIR", default=str(BASE_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{DATA_DIR / 'floppy.sqlite3'}"),
}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)

# --- Backend selection driven by the actual database ---
# Standalone defaults to SQLite but can be pointed at Postgres via DATABASE_URL,
# so the DB-dependent bits (write concurrency + search) are chosen from the engine.
if "sqlite" in DATABASES["default"]["ENGINE"]:
    # One SQLite file is served by multiple gunicorn workers here. Without this,
    # two concurrent writes (e.g. a multi-file upload committing several files at
    # once) race and one fails with "database is locked". WAL lets readers run
    # alongside a writer; a busy timeout makes a second writer *wait* for the
    # lock instead of erroring; IMMEDIATE transactions take the write lock up
    # front so the wait happens before work, not mid-transaction.
    _opts = DATABASES["default"].setdefault("OPTIONS", {})
    _opts.setdefault("timeout", env.int("SQLITE_TIMEOUT", default=30))
    _opts.setdefault("transaction_mode", "IMMEDIATE")
    _opts.setdefault(
        "init_command",
        "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;",
    )
    # Postgres full-text search (websearch_to_tsquery) doesn't exist on SQLite;
    # use the portable substring service, which honors folder-scoping identically.
    SEARCH_SERVICE = env("SEARCH_SERVICE", default="apps.search.services.basic.BasicSearchService")
else:
    SEARCH_SERVICE = env("SEARCH_SERVICE", default="apps.search.services.postgres.PostgresSearchService")

DEV_STORAGE_DIR = env("DEV_STORAGE_DIR", default=str(DATA_DIR / "storage"))

# No broker: tasks (e.g. video transcode) run inline in the web process.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = False

# Marks single-process mode; apps.common starts the maintenance thread when set.
STANDALONE = True

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

# Auto-provision a durable secret on first boot so self-hosters configure nothing
# (sessions / verify tokens then survive restarts). Override with DJANGO_SECRET_KEY.
_env_key = env("DJANGO_SECRET_KEY", default="")
if _env_key and _env_key != "insecure-dev-key-change-me":
    SECRET_KEY = _env_key
else:
    _keyfile = DATA_DIR / "secret_key"
    if _keyfile.exists():
        SECRET_KEY = _keyfile.read_text().strip()
    else:
        from django.core.management.utils import get_random_secret_key

        SECRET_KEY = get_random_secret_key()
        _keyfile.write_text(SECRET_KEY)
        try:
            _keyfile.chmod(0o600)
        except OSError:  # pragma: no cover - best effort on odd filesystems
            pass

# Security: don't force HTTPS (a self-host may be plain-http on a LAN or behind
# the user's own TLS proxy). Turn these on via env for a public TLS deployment.
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=False)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=False)
SECURE_CONTENT_TYPE_NOSNIFF = True

# When TLS is terminated by a reverse proxy (Caddy/nginx/Traefik) in front, the
# app receives plain HTTP on the internal hop. Enable this so Django trusts the
# proxy's X-Forwarded-Proto header and knows the original request was HTTPS -
# otherwise SECURE_SSL_REDIRECT loops and secure cookies never set. ONLY enable
# when actually behind such a proxy (else the header can be spoofed).
if env.bool("USE_PROXY_SSL_HEADER", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Optional HSTS for a public HTTPS deployment (0 = off, the safe default). Set to
# e.g. 31536000 (1 year) once you're certain everything is served over HTTPS.
_hsts = env.int("SECURE_HSTS_SECONDS", default=0)
if _hsts > 0:
    SECURE_HSTS_SECONDS = _hsts
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
    SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)

# --- Email delivery ---
# Zero config: with no SMTP set, verification/reset emails print to the container
# log (console backend), so a solo self-host works out of the box. To send real
# email, just set EMAIL_HOST (+ credentials) - that alone switches to SMTP; an
# explicit EMAIL_BACKEND always wins.
EMAIL_HOST = env("EMAIL_HOST", default="")
_email_backend = env("EMAIL_BACKEND", default="")
if _email_backend:
    EMAIL_BACKEND = _email_backend
elif EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
# TLS (STARTTLS, port 587) is the common case; SSL (port 465) is the alternative.
# Django rejects both being on at once, so SSL wins when explicitly enabled.
EMAIL_USE_TLS = False if EMAIL_USE_SSL else env.bool("EMAIL_USE_TLS", default=True)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=15)

# Verification / password-reset links must point at THIS app's own origin - the
# SPA is served from here in standalone mode, not the dev Vite server on :5173
# (the base default). Set this to your public URL for a real deployment.
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:8000")

# Serve the built SPA (frontend/dist) at the root via WhiteNoise; unknown,
# non-API routes fall through to the SPA index (see config/urls.py).
FRONTEND_DIST = Path(env("FRONTEND_DIST", default=str(BASE_DIR.parent / "frontend" / "dist")))
SERVE_SPA = FRONTEND_DIST.exists()
if SERVE_SPA:
    WHITENOISE_ROOT = str(FRONTEND_DIST)
    WHITENOISE_INDEX_FILE = True

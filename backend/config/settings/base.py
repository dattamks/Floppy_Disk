"""
Base Django settings for Floppy Disk.

Configuration is environment-variable driven (see .env.example) so the same
codebase runs on Railway now and AWS ECS Fargate later with only env changes.
Environment-specific overrides live in local.py / production.py.
"""
from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# Read a .env file if present (local dev); in prod, env comes from the platform.
environ.Env.read_env(BASE_DIR / ".env")

# --- Core -------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-dev-key-change-me")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# --- Applications -----------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
]

LOCAL_APPS = [
    "apps.common",
    "apps.accounts",
    "apps.storage",
    "apps.sharing",
    "apps.billing",
    "apps.moderation",
    "apps.notifications",
    "apps.analytics",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database ---------------------------------------------------------------
# DATABASE_URL e.g. postgres://user:pass@host:5432/dbname
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://floppy:floppy@localhost:5432/floppy",
    ),
}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)

# --- Auth -------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"
# Phase 1: email/password via Django auth, behind the AuthProvider abstraction.
# Phase 2 swaps in Cognito by pointing this at a different provider.
AUTH_PROVIDER = env("AUTH_PROVIDER", default="apps.accounts.providers.django_auth.DjangoAuthProvider")

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- DRF --------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.ApiKeyAuthentication",  # Bearer (MCP/integrations)
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    # Concrete per-scope rates come from the rate-limit spec (PRD 5.2).
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/day",
        "password_reset": "10/day",
        "register": "20/day",
        "report": "10/hour",
        "share_unlock": "10/day",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
}

# --- Celery -----------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# Scheduled jobs (daily). Times are UTC; the beat worker runs these.
CELERY_BEAT_SCHEDULE = {
    "purge-expired-trash": {
        "task": "apps.storage.tasks.purge_expired_trash_task",
        "schedule": 24 * 60 * 60,
    },
    "release-expired-reservations": {
        "task": "apps.storage.tasks.release_expired_reservations_task",
        "schedule": 60 * 60,
    },
    "subscription-freeze-lifecycle": {
        "task": "apps.billing.tasks.run_freeze_lifecycle_task",
        "schedule": 24 * 60 * 60,
    },
    "hard-delete-expired-accounts": {
        "task": "apps.accounts.tasks.hard_delete_expired_accounts_task",
        "schedule": 24 * 60 * 60,
    },
}

# --- Cloudflare R2 / Stream (env-var driven, S3-compatible) -----------------
R2_ACCOUNT_ID = env("R2_ACCOUNT_ID", default="")
R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID", default="")
R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY", default="")
R2_ENDPOINT_URL = env("R2_ENDPOINT_URL", default="")
# Region -> bucket name map for data residency (per-region dedup). JSON in env.
R2_REGION_BUCKETS = env.json("R2_REGION_BUCKETS", default={})
CLOUDFLARE_STREAM_ACCOUNT_ID = env("CLOUDFLARE_STREAM_ACCOUNT_ID", default="")
CLOUDFLARE_STREAM_API_TOKEN = env("CLOUDFLARE_STREAM_API_TOKEN", default="")

# Automatic fallback: when the Cloudflare env vars are missing, serve media from
# a local media folder and deliver video directly (no Stream/HD). An explicit
# STORAGE_SERVICE / VIDEO_SERVICE env var still overrides these defaults.
R2_CONFIGURED = bool(R2_ENDPOINT_URL and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_REGION_BUCKETS)
CLOUDFLARE_STREAM_ENABLED = bool(CLOUDFLARE_STREAM_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN)

STORAGE_SERVICE = env(
    "STORAGE_SERVICE",
    default="apps.storage.services.r2.R2StorageService" if R2_CONFIGURED
    else "apps.storage.services.local.LocalStorageService",
)
VIDEO_SERVICE = env(
    "VIDEO_SERVICE",
    default="apps.storage.services.video.CloudflareStreamService" if CLOUDFLARE_STREAM_ENABLED
    else "apps.storage.services.video.FakeVideoService",
)
# Local media folder used by LocalStorageService when R2 isn't configured.
DEV_STORAGE_DIR = env("DEV_STORAGE_DIR", default=str(BASE_DIR / "media"))

# --- Payments (Razorpay behind PaymentGateway abstraction) ------------------
# Master switch: when disabled, billing is deferred — new signups are granted the
# default paid plan (see DEFAULT_SIGNUP_PLAN) and the client hides upgrade/billing UI.
RAZORPAY_ENABLED = env.bool("RAZORPAY_ENABLED", default=False)
DEFAULT_SIGNUP_PLAN = env("DEFAULT_SIGNUP_PLAN", default="paid_2tb")  # used only when billing disabled
PAYMENT_GATEWAY = env("PAYMENT_GATEWAY", default="apps.billing.gateways.razorpay.RazorpayGateway")
RAZORPAY_KEY_ID = env("RAZORPAY_KEY_ID", default="")
RAZORPAY_KEY_SECRET = env("RAZORPAY_KEY_SECRET", default="")
RAZORPAY_WEBHOOK_SECRET = env("RAZORPAY_WEBHOOK_SECRET", default="")

# --- Search (Postgres FTS now, OpenSearch later) ----------------------------
SEARCH_SERVICE = env("SEARCH_SERVICE", default="apps.search.services.postgres.PostgresSearchService")

# --- ClamAV (malware scanning) ----------------------------------------------
CLAMAV_HOST = env("CLAMAV_HOST", default="localhost")
CLAMAV_PORT = env.int("CLAMAV_PORT", default=3310)
SCAN_SERVICE = env("SCAN_SERVICE", default="apps.moderation.services.clamav.ClamAVScanService")
# What to do when the scanner is unreachable: "closed" (safe: block/quarantine
# the upload) or "open" (risky: let it through unscanned). Defaults to closed.
SCAN_FAILURE_MODE = env("SCAN_FAILURE_MODE", default="closed")

# --- i18n / tz --------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- Static -----------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- CORS / CSRF ------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"])
# Django 4+ Origin-header CSRF check needs the SPA's origin trusted (the dev
# server proxies to us, so the browser Origin is the Vite host).
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)

# --- Email -------------------------------------------------------------------
# Delivery goes through EMAIL_BACKEND (console in dev, SES/SMTP in prod).
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Floppy Disk <no-reply@floppy.disk>")
# Base URL of the web app, used to build verification / reset links in emails.
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:5173")

# --- Legal / compliance ------------------------------------------------------
# Grievance Officer contact (India IT Rules 2021). Set real values in prod.
GRIEVANCE_OFFICER_NAME = env("GRIEVANCE_OFFICER_NAME", default="")
GRIEVANCE_OFFICER_EMAIL = env("GRIEVANCE_OFFICER_EMAIL", default="grievance@floppy.disk")
GRIEVANCE_OFFICER_ADDRESS = env("GRIEVANCE_OFFICER_ADDRESS", default="")
# Current policy versions surfaced to clients + recorded on consent.
TOS_VERSION = env("TOS_VERSION", default="2026-01-01")
PRIVACY_VERSION = env("PRIVACY_VERSION", default="2026-01-01")

# --- Sentry (optional) ------------------------------------------------------
SENTRY_DSN = env("SENTRY_DSN", default="")

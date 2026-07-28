"""Production settings (Railway now, AWS ECS Fargate later)."""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import SECRET_KEY, SENTRY_DSN, env

DEBUG = False

# Fail fast rather than boot on the publicly-known dev key (which would make
# sessions and password-reset/verify tokens forgeable).
if SECRET_KEY == "insecure-dev-key-change-me":
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production.")

# Security hardening; behind Railway/Cloudflare TLS termination.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=2592000)  # 30 days
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True

EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")

# Error tracking is optional: only pulled in when a DSN is configured, so the
# app deploys fine without sentry-sdk / observability set up.
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1, send_default_pii=False)

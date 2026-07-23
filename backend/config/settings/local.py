"""Local/dev settings."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = ["*"]

# Console email backend for dev (verification / reset links print to stdout).
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Relax throttling noise in dev; real limits are exercised in prod/tests.
INTERNAL_IPS = ["127.0.0.1"]

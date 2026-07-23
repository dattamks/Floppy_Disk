"""Local/dev settings."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = ["*"]

# Console email backend for dev (verification / reset links print to stdout).
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Relax throttling noise in dev; real limits are exercised in prod/tests.
INTERNAL_IPS = ["127.0.0.1"]

# Storage: local disk-backed service in dev (R2 in production).
STORAGE_SERVICE = "apps.storage.services.local.LocalStorageService"
DEV_STORAGE_DIR = env("DEV_STORAGE_DIR", default=str(BASE_DIR / ".devstorage"))

# Scanning: fake scanner in dev (ClamAV in production).
SCAN_SERVICE = "apps.moderation.services.fake.FakeScanService"

# Payments: fake gateway (instant activation) in dev/tests.
PAYMENT_GATEWAY = "apps.billing.gateways.fake.FakePaymentGateway"

# Video: fake Stream service in dev/tests.
VIDEO_SERVICE = "apps.storage.services.video.FakeVideoService"

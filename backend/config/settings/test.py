"""Test settings: in-memory SQLite, fast hasher, no external services."""
from .base import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Disable throttling noise in unit tests (rate limits are asserted separately).
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405

# Storage: use the local disk-backed service for tests.
STORAGE_SERVICE = "apps.storage.services.local.LocalStorageService"
DEV_STORAGE_DIR = "/tmp/claude-0/-home-user-Floppy-Disk/5c03de2b-195c-53d0-b890-a3793c5ab2e1/scratchpad/devstorage_test"

# Scanning: fake scanner (detects EICAR) for tests.
SCAN_SERVICE = "apps.moderation.services.fake.FakeScanService"

# Payments: fake gateway (instant activation) in dev/tests.
PAYMENT_GATEWAY = "apps.billing.gateways.fake.FakePaymentGateway"

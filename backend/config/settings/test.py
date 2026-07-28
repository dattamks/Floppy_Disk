"""Test settings: in-memory SQLite, fast hasher, no external services."""
import tempfile

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

# Storage: use the local disk-backed service for tests, in a throwaway temp dir
# (portable + hermetic — no machine-specific path).
STORAGE_SERVICE = "apps.storage.services.local.LocalStorageService"
DEV_STORAGE_DIR = tempfile.mkdtemp(prefix="floppy-test-storage-")

# Video: no-binary fake transcoder in tests (real FFmpeg runs in production).
MEDIA_TRANSCODER = "apps.storage.services.transcode.FakeTranscoder"

# Run Celery tasks inline (no broker) so the transcode task executes in tests.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"

# Search: portable substring search in dev/tests (Postgres FTS in production).
SEARCH_SERVICE = "apps.search.services.basic.BasicSearchService"

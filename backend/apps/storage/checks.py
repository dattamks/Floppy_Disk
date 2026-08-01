"""System checks + boot warning about where files actually live.

Storage backend selection mirrors the database: if Cloudflare R2 is configured
(credentials + a bucket), files go to R2 - durable object storage, no server
disk needed. Otherwise the app falls back to the **local-disk** backend, which
is only as durable as the directory it writes to. On many hosts that directory
is ephemeral (wiped on restart/redeploy), so we surface a loud warning telling
the operator to attach a persistent volume - or configure R2 - before they
trust it with real data.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.checks import Warning as CheckWarning
from django.core.checks import register

logger = logging.getLogger(__name__)

_LOCAL_BACKEND = "apps.storage.services.local.LocalStorageService"

W_LOCAL_STORAGE = "storage.W001"


def using_local_storage() -> bool:
    """True when the *effective* backend is local disk.

    Consults the owner-set StorageConfig (so the warning clears once R2 is
    configured in the UI), but falls back to the settings-level backend if the
    database isn't ready yet (e.g. during `migrate`, before the table exists)."""
    try:
        from .config import effective_backend

        return effective_backend() == "local"
    except Exception:  # noqa: BLE001 - DB not migrated / unavailable during checks
        return getattr(settings, "STORAGE_SERVICE", "") == _LOCAL_BACKEND


def _local_storage_message() -> str:
    where = getattr(settings, "DEV_STORAGE_DIR", "the local data directory")
    return (
        f"Using LOCAL file storage at {where}. Files persist ONLY if that path is "
        "a durable/persistent volume - on ephemeral hosts they are LOST on "
        "restart or redeploy. Attach a persistent volume there, or configure "
        "Cloudflare R2 (set R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, "
        "R2_SECRET_ACCESS_KEY and R2_BUCKET) for durable object storage - R2 is "
        "auto-detected, just like Postgres via DATABASE_URL."
    )


@register()
def local_storage_persistence_check(app_configs, **kwargs):
    # Only a real deployment needs the nudge; local dev / the test suite run on
    # local storage by design and shouldn't be nagged.
    if settings.DEBUG or not using_local_storage():
        return []
    return [
        CheckWarning(
            _local_storage_message(),
            hint="Set R2_* env vars for R2, or mount a persistent volume at DEV_STORAGE_DIR.",
            id=W_LOCAL_STORAGE,
        )
    ]


def log_storage_backend_at_boot() -> None:
    """Emit a one-line storage summary to the server log at startup."""
    if using_local_storage():
        logger.warning("[storage] %s", _local_storage_message())
    else:
        logger.info("[storage] Durable object storage backend: %s", settings.STORAGE_SERVICE)

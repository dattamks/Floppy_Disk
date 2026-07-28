"""
DPDPA compliance: account deletion + data export (PRD 5.11).

- Deletion soft-deletes immediately; a daily job hard-deletes (cascading) after
  30 days.
- Data export builds a zip manifest of the user's data with an expiring link.
"""
from __future__ import annotations

import io
import json
import logging
import zipfile
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

from apps.storage.lifecycle import purge_file
from apps.storage.models import File, Folder
from apps.storage.services.base import get_storage_service

from .models import DataExport

HARD_DELETE_AFTER = timedelta(days=30)
EXPORT_TTL = timedelta(days=7)


def hard_delete_expired_accounts(*, now) -> int:
    """Daily job: purge accounts soft-deleted > 30 days ago."""
    User = get_user_model()
    cutoff = now - HARD_DELETE_AFTER
    deleted = 0
    qs = User.objects.filter(status=User.Status.DELETED, deleted_at__lte=cutoff)
    for user in qs:
        # Each account is purged atomically so a mid-loop failure can't leave one
        # half-deleted (some blobs gone, user row still present) and doesn't abort
        # the whole batch — the rest of the accounts still get processed.
        try:
            with transaction.atomic():
                for f in list(File.objects.filter(owner=user)):
                    purge_file(f)
                user.delete()  # cascades folders, memberships, notifications, etc.
        except Exception:  # noqa: BLE001 - isolate one bad account from the batch
            logger.exception("Hard-delete failed for account %s", user.pk)
            continue
        deleted += 1
    return deleted


def build_export(user) -> tuple[DataExport, str]:
    """Assemble a data-export zip (manifest of the user's data) and store it."""
    files = File.objects.filter(owner=user, deleted_at__isnull=True)
    folders = Folder.objects.filter(owner=user, deleted_at__isnull=True)
    manifest = {
        "account": {
            "id": str(user.id), "email": user.email,
            "created_at": user.created_at.isoformat(),
        },
        "files": [
            {"name": f.name, "size_bytes": f.size_bytes, "kind": f.kind,
             "created_at": f.created_at.isoformat()} for f in files
        ],
        "folders": [{"name": fo.name} for fo in folders],
        "exported_at": timezone.now().isoformat(),
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2))
    data = buf.getvalue()

    storage = get_storage_service()
    key = f"exports/{user.id}/export.zip"
    if hasattr(storage, "save_bytes"):
        storage.save_bytes(region=user.storage_region, object_key=key, data=data)
    url = storage.presign_download(region=user.storage_region, object_key=key)

    export = DataExport.objects.create(
        user=user, object_key=key, size_bytes=len(data),
        expires_at=timezone.now() + EXPORT_TTL,
    )
    return export, url

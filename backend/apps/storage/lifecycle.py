"""
Trash lifecycle: soft-delete, restore, and purge (PRD 5.3).

Trash counts toward quota until purged. Purge decrements the denormalized
storage counter and the StorageObject ref_count, hard-deleting the blob at 0.
Retention: 7 days (free) / 30 days (paid).
"""
from datetime import timedelta

from django.db import models, transaction
from django.utils import timezone

from .models import File, StorageObject
from .services.base import get_storage_service

RETENTION_FREE = timedelta(days=7)
RETENTION_PAID = timedelta(days=30)


def retention_for(user) -> timedelta:
    return RETENTION_FREE if user.tier == user.Tier.FREE else RETENTION_PAID


@transaction.atomic
def purge_file(file: File) -> None:
    """
    Permanently remove a File: release its committed quota, decrement the
    StorageObject ref_count, and hard-delete the blob when nothing references it.
    """
    file = File.objects.select_for_update().get(pk=file.pk)
    obj = file.storage_object

    # Release committed usage only for files that were actually committed (ready).
    if file.status == File.Status.READY and file.size_bytes:
        type(file.owner).objects.filter(pk=file.owner_id).update(
            storage_used_bytes=models.F("storage_used_bytes") - file.size_bytes
        )

    # Delete the File row first so it no longer PROTECTs the StorageObject.
    file.delete()

    file_region = None
    file_key = None
    if obj is not None:
        StorageObject.objects.filter(pk=obj.pk).update(ref_count=models.F("ref_count") - 1)
        obj.refresh_from_db()
        if obj.ref_count <= 0:
            file_region, file_key = obj.region, obj.object_key
            obj.delete()

    # Best-effort blob delete after the row is gone.
    if file_key:
        try:
            get_storage_service().delete_object(region=file_region, object_key=file_key)
        except Exception:  # noqa: BLE001 - storage cleanup must not block the purge
            pass


@transaction.atomic
def purge_folder(folder) -> None:
    """Permanently remove a folder and its whole subtree.

    Every file under the folder (at any depth) is purged (quota released, blobs
    removed); the folders themselves are then hard-deleted. Used for "delete
    permanently" from trash.
    """
    from .models import Folder

    # Collect the folder + all descendant folder ids (breadth-first).
    ids = [folder.pk]
    frontier = [folder.pk]
    while frontier:
        kids = list(Folder.objects.filter(parent_id__in=frontier).values_list("pk", flat=True))
        ids.extend(kids)
        frontier = kids

    # Purge files first (File.folder is SET_NULL, so they must go before folders).
    for f in File.objects.filter(folder_id__in=ids):
        purge_file(f)
    Folder.objects.filter(pk__in=ids).delete()


def purge_expired_trash() -> int:
    """Daily job: hard-delete trashed files past their tier retention. Returns count."""
    now = timezone.now()
    count = 0
    qs = File.objects.filter(deleted_at__isnull=False).select_related("owner")
    for file in qs.iterator():
        cutoff = file.deleted_at + retention_for(file.owner)
        if cutoff <= now:
            purge_file(file)
            count += 1
    return count

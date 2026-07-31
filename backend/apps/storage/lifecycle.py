"""
Trash lifecycle: soft-delete, restore, and purge.

Trash counts toward quota until purged. Purge decrements the denormalized
storage counter and the StorageObject ref_count, hard-deleting the blob at 0.
Retention: 30 days.
"""
from datetime import timedelta

from django.db import models, transaction
from django.utils import timezone

from .models import File, Folder, StorageObject
from .services.base import get_storage_service

RETENTION = timedelta(days=30)  # single storage tier (no billing)


def retention_for(user) -> timedelta:
    return RETENTION


def _release_object(obj: StorageObject) -> None:
    """Decrement a blob's ref_count; hard-delete the row + bytes when it hits 0.

    The row is locked for the whole decrement-read-delete so two concurrent
    releases of files sharing one blob can't both read a stale count (double
    delete / negative ref_count) or race the delete. Callers run inside an
    atomic block, which `select_for_update` requires.
    """
    if obj is None:
        return
    locked = StorageObject.objects.select_for_update().filter(pk=obj.pk).first()
    if locked is None:
        return  # already released by a concurrent purge
    StorageObject.objects.filter(pk=locked.pk).update(ref_count=models.F("ref_count") - 1)
    locked.refresh_from_db()
    if locked.ref_count <= 0:
        region, key = locked.region, locked.object_key
        locked.delete()
        try:  # best-effort blob delete after the row is gone
            get_storage_service().delete_object(region=region, object_key=key)
        except Exception:  # noqa: BLE001 - storage cleanup must not block the purge
            pass


@transaction.atomic
def purge_file(file: File) -> None:
    """
    Permanently remove a File: release its committed quota and every blob it
    references - the original plus any transcoded video rendition and poster -
    hard-deleting each blob once nothing else references it.
    """
    file = File.objects.select_for_update().select_related(
        "storage_object", "playable_object", "poster_object"
    ).get(pk=file.pk)
    main = file.storage_object

    # Distinct derived blobs (transcoded MP4 + poster), skipping any that alias
    # the original so we never double-decrement one object.
    extras = []
    seen = {main.pk} if main is not None else set()
    for o in (file.playable_object, file.poster_object):
        if o is not None and o.pk not in seen:
            extras.append(o)
            seen.add(o.pk)

    # Release committed usage for any file whose bytes were committed. That's
    # READY files *and* videos still in PROCESSING (their reservation is committed
    # the moment the upload completes, before transcoding). Excluding PROCESSING
    # here leaked quota when a still-transcoding video was purged. PENDING files
    # were never committed, so they must not be refunded.
    if file.status in (File.Status.READY, File.Status.PROCESSING) and file.size_bytes:
        type(file.owner).objects.filter(pk=file.owner_id).update(
            storage_used_bytes=models.F("storage_used_bytes") - file.size_bytes
        )

    # Delete the File row first so it no longer PROTECTs the StorageObject.
    file.delete()

    _release_object(main)
    for obj in extras:
        _release_object(obj)


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
    """Daily job: hard-delete trashed items past the retention window.

    Operates on *top-level* trashed items (mirroring the Trash view and
    restore-as-a-unit): a trashed folder is purged with its whole subtree, so
    folder rows no longer linger forever after their files age out.
    """
    now = timezone.now()
    count = 0

    folders = Folder.objects.filter(
        deleted_at__isnull=False, trashed_root__isnull=True
    ).select_related("owner")
    for folder in folders:
        if folder.deleted_at + retention_for(folder.owner) <= now:
            purge_folder(folder)
            count += 1

    files = File.objects.filter(
        deleted_at__isnull=False, trashed_root__isnull=True
    ).select_related("owner")
    for file in files.iterator():
        if file.deleted_at + retention_for(file.owner) <= now:
            purge_file(file)
            count += 1
    return count


def purge_abandoned_uploads() -> int:
    """Delete PENDING files whose upload was never completed and whose
    reservation window has lapsed (abandoned uploads). Returns count.

    Such rows otherwise accumulate forever: only the reservation is expired,
    never the File. They hold no committed quota and have no StorageObject, but
    bytes may have been PUT to the deterministic key, so we best-effort delete
    those too.
    """
    from .quota import RESERVATION_TTL

    cutoff = timezone.now() - RESERVATION_TTL
    count = 0
    storage = get_storage_service()
    stale = File.objects.filter(
        status=File.Status.PENDING, created_at__lte=cutoff
    ).select_related("owner")
    for f in stale:
        try:  # best-effort: remove any bytes uploaded before the upload was abandoned
            storage.delete_object(region=f.owner.storage_region, object_key=f"{f.owner_id}/{f.id}")
        except Exception:  # noqa: BLE001 - cleanup must not block the job
            pass
        f.delete()
        count += 1
    return count

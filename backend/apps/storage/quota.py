"""
Reserve-then-commit quota.

Closes the TOCTOU race where concurrent uploads all pass a stale
`storage_used_bytes` check: quota is atomically reserved when a presigned upload
is issued, committed on completion, and released when the reservation expires.
"""
import shutil
from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from .models import MAX_FILE_BYTES, File, StorageReservation

RESERVATION_TTL = timedelta(hours=1)


class QuotaError(Exception):
    """Base for quota-related failures."""


class QuotaExceeded(QuotaError):
    """The requested bytes don't fit within the remaining quota."""


class FileTooLarge(QuotaError):
    """The requested file exceeds the per-file cap."""


def per_file_cap(user) -> int:
    return MAX_FILE_BYTES


def _live_reserved_bytes(user) -> int:
    now = timezone.now()
    agg = (
        StorageReservation.objects.filter(
            owner=user, status=StorageReservation.Status.ACTIVE, expires_at__gt=now
        ).aggregate(total=models.Sum("bytes"))
    )
    return agg["total"] or 0


def _storage_dir() -> str | None:
    """The filesystem path local blobs live under, or None if not configured."""
    return getattr(settings, "DEV_STORAGE_DIR", None)


def disk_usage():
    """(total, used, free) bytes of the local storage volume, or None on failure
    or when a directory in the chain doesn't exist yet."""
    path = _storage_dir()
    if not path:
        return None
    import os

    # disk_usage needs an existing path; walk up to the nearest existing parent.
    while path and not os.path.exists(path):
        parent = os.path.dirname(path)
        if parent == path:
            return None
        path = parent
    try:
        return shutil.disk_usage(path)
    except OSError:
        return None


def _disk_tracking() -> bool:
    """True when the quota should follow the real local disk."""
    if not getattr(settings, "STORAGE_TRACK_DISK", True):
        return False
    from .config import effective_backend

    return effective_backend() == "local"


def disk_free_bytes(user) -> int | None:
    """Real free space on the local storage volume, or None on R2/unknown/off."""
    if not _disk_tracking():
        return None
    du = disk_usage()
    return du.free if du else None


def effective_quota_bytes(user) -> int:
    """The storage ceiling actually shown + enforced.

    Precedence: an explicit STORAGE_QUOTA_BYTES override wins; otherwise the
    per-user quota, but on local storage capped to the real disk size so the
    sidebar meter isn't a fictional flat 2 TB. Enforcement uses the same value,
    so what's shown and what's allowed never diverge.
    """
    override = int(getattr(settings, "STORAGE_QUOTA_BYTES", 0) or 0)
    if override > 0:
        return override
    quota = user.quota_bytes
    if _disk_tracking():
        du = disk_usage()
        if du:
            return min(quota, du.total)
    return quota


# Back-compat alias: some call sites/tests reference the old name.
def _quota_limit(user) -> int:
    return effective_quota_bytes(user)


def available_bytes(user) -> int:
    """Remaining quota after committed usage AND live reservations, never more
    than what the disk can actually still hold (local)."""
    logical = effective_quota_bytes(user) - user.storage_used_bytes - _live_reserved_bytes(user)
    free = disk_free_bytes(user)
    if free is not None:
        return max(0, min(logical, free))
    return logical


@transaction.atomic
def reserve(user, *, size_bytes: int, file: File | None = None) -> StorageReservation:
    """
    Atomically reserve `size_bytes` against the user's quota.

    Locks the user row so concurrent reservations can't both pass the check.
    Raises FileTooLarge / QuotaExceeded on rejection.
    """
    if size_bytes <= 0:
        raise QuotaError("size_bytes must be positive")
    if size_bytes > per_file_cap(user):
        raise FileTooLarge(
            f"File exceeds the {per_file_cap(user) // 1024**3} GB per-file limit."
        )

    # Reject up front if the local disk physically can't hold this - otherwise
    # the write later fails deep in the storage layer with a raw "No space left
    # on device" 500 instead of a clean, actionable error.
    free = disk_free_bytes(user)
    if free is not None and size_bytes > free:
        raise QuotaExceeded("Not enough free disk space on the server.")

    # Lock the owner row: serializes concurrent reservations for this user.
    locked = user.__class__.objects.select_for_update().get(pk=user.pk)
    used = locked.storage_used_bytes
    reserved = _live_reserved_bytes(locked)
    if used + reserved + size_bytes > effective_quota_bytes(locked):
        raise QuotaExceeded("Not enough storage quota remaining.")

    return StorageReservation.objects.create(
        owner=locked,
        file=file,
        bytes=size_bytes,
        status=StorageReservation.Status.ACTIVE,
        expires_at=timezone.now() + RESERVATION_TTL,
    )


@transaction.atomic
def commit(reservation: StorageReservation, *, actual_bytes: int | None = None) -> None:
    """Convert a live reservation into confirmed usage (idempotent-ish).

    Charges `actual_bytes` (the real uploaded size) when given, rather than the
    client-*claimed* size the reservation was opened with. Committing the claimed
    size lets a caller reserve 1 byte and upload gigabytes (quota under-count),
    and leaves permanent drift when the real size differs - because purge later
    refunds the file's real `size_bytes`, not the reserved amount.
    """
    res = StorageReservation.objects.select_for_update().get(pk=reservation.pk)
    if res.status != StorageReservation.Status.ACTIVE:
        return  # already committed or expired
    charge = res.bytes if actual_bytes is None else actual_bytes
    user = res.owner.__class__.objects.select_for_update().get(pk=res.owner_id)
    user.storage_used_bytes = models.F("storage_used_bytes") + charge
    user.save(update_fields=["storage_used_bytes", "updated_at"])
    res.bytes = charge  # keep the reservation consistent with what was charged
    res.status = StorageReservation.Status.COMMITTED
    res.save(update_fields=["bytes", "status", "updated_at"])


@transaction.atomic
def charge_usage(user, size_bytes: int) -> None:
    """Directly add committed usage for `user` (no reservation).

    Used when an upload completes after its reservation already expired: the
    bytes are real and on disk, so they must be counted - otherwise a later
    purge subtracts a size that was never added and drives storage_used_bytes
    negative (free quota).
    """
    if size_bytes <= 0:
        return
    locked = user.__class__.objects.select_for_update().get(pk=user.pk)
    locked.storage_used_bytes = models.F("storage_used_bytes") + size_bytes
    locked.save(update_fields=["storage_used_bytes", "updated_at"])


def release_expired() -> int:
    """Mark expired active reservations as expired (daily cleanup job). Returns count."""
    now = timezone.now()
    return StorageReservation.objects.filter(
        status=StorageReservation.Status.ACTIVE, expires_at__lte=now
    ).update(status=StorageReservation.Status.EXPIRED)

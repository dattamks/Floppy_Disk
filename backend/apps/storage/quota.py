"""
Reserve-then-commit quota (PRD 5.3).

Closes the TOCTOU race where concurrent uploads all pass a stale
`storage_used_bytes` check: quota is atomically reserved when a presigned upload
is issued, committed on completion, and released when the reservation expires.
"""
from datetime import timedelta

from django.db import models, transaction
from django.utils import timezone

from .models import FREE_MAX_FILE_BYTES, PAID_MAX_FILE_BYTES, File, StorageReservation

RESERVATION_TTL = timedelta(hours=1)


class QuotaError(Exception):
    """Base for quota-related failures."""


class QuotaExceeded(QuotaError):
    """The requested bytes don't fit within the remaining quota."""


class FileTooLarge(QuotaError):
    """The requested file exceeds the per-file cap for the user's tier."""


def per_file_cap(user) -> int:
    return FREE_MAX_FILE_BYTES if user.tier == user.Tier.FREE else PAID_MAX_FILE_BYTES


def _live_reserved_bytes(user) -> int:
    now = timezone.now()
    agg = (
        StorageReservation.objects.filter(
            owner=user, status=StorageReservation.Status.ACTIVE, expires_at__gt=now
        ).aggregate(total=models.Sum("bytes"))
    )
    return agg["total"] or 0


def available_bytes(user) -> int:
    """Remaining quota after committed usage AND live reservations."""
    return user.quota_bytes - user.storage_used_bytes - _live_reserved_bytes(user)


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
            f"File exceeds the {per_file_cap(user) // 1024**3} GB per-file limit for your tier."
        )

    # Lock the owner row: serializes concurrent reservations for this user.
    locked = user.__class__.objects.select_for_update().get(pk=user.pk)
    used = locked.storage_used_bytes
    reserved = _live_reserved_bytes(locked)
    if used + reserved + size_bytes > locked.quota_bytes:
        raise QuotaExceeded("Not enough storage quota remaining.")

    return StorageReservation.objects.create(
        owner=locked,
        file=file,
        bytes=size_bytes,
        status=StorageReservation.Status.ACTIVE,
        expires_at=timezone.now() + RESERVATION_TTL,
    )


@transaction.atomic
def commit(reservation: StorageReservation) -> None:
    """Convert a live reservation into confirmed usage (idempotent-ish)."""
    res = StorageReservation.objects.select_for_update().get(pk=reservation.pk)
    if res.status != StorageReservation.Status.ACTIVE:
        return  # already committed or expired
    user = res.owner.__class__.objects.select_for_update().get(pk=res.owner_id)
    user.storage_used_bytes = models.F("storage_used_bytes") + res.bytes
    user.save(update_fields=["storage_used_bytes", "updated_at"])
    res.status = StorageReservation.Status.COMMITTED
    res.save(update_fields=["status", "updated_at"])


def release_expired() -> int:
    """Mark expired active reservations as expired (daily cleanup job). Returns count."""
    now = timezone.now()
    return StorageReservation.objects.filter(
        status=StorageReservation.Status.ACTIVE, expires_at__lte=now
    ).update(status=StorageReservation.Status.EXPIRED)

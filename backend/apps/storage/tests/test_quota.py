"""Reserve-then-commit quota, instance-wide (single shared pool).

Usage and the ceiling are instance-wide, not per user. These exercise the
reservation mechanics and R2-budget enforcement; disk-bound local behavior and
deduplication live in test_quota_instance.py / test_quota_disk.py.
"""
import pytest
from django.contrib.auth import get_user_model

from apps.storage.models import (
    MAX_FILE_BYTES,
    StorageConfig,
    StorageObject,
    StorageReservation,
)
from apps.storage.quota import (
    FileTooLarge,
    QuotaExceeded,
    available_bytes,
    commit,
    release_expired,
    reserve,
)

User = get_user_model()
pytestmark = pytest.mark.django_db
GB = 1024**3


@pytest.fixture
def user(db):
    return User.objects.create_user(email="q@floppy.disk", password="hunter2pass")


@pytest.fixture
def r2_cap(db):
    """An R2 backend with a small, enforced 10 GB budget (overflow off) so the
    reservation math is readable and the cap actually rejects."""
    cfg = StorageConfig.load()
    cfg.backend = StorageConfig.Backend.R2
    cfg.r2_endpoint_url = "https://x.r2.cloudflarestorage.com"
    cfg.r2_access_key_id = "k"
    cfg.r2_secret_ciphertext = "enc"
    cfg.r2_bucket = "b"
    cfg.r2_quota_bytes = 10 * GB
    cfg.allow_overflow = False
    cfg.save()
    return cfg


def _store(size, h):
    """A real stored blob (counts toward instance-wide used)."""
    return StorageObject.objects.create(
        content_hash=h, region="ap-south", size_bytes=size, ref_count=1,
        status=StorageObject.Status.READY,
    )


def test_available_starts_at_full_cap(user, r2_cap):
    assert available_bytes() == 10 * GB


def test_reserve_reduces_available_before_commit(user, r2_cap):
    reserve(user, size_bytes=3 * GB)
    # Reservation is live but not yet committed -> available reflects it.
    assert available_bytes() == 7 * GB


def test_concurrent_reservations_cannot_exceed_cap(user, r2_cap):
    reserve(user, size_bytes=6 * GB)
    # A second reservation that would push past the cap is rejected, even before
    # anything commits (the TOCTOU race the design fixes).
    with pytest.raises(QuotaExceeded):
        reserve(user, size_bytes=5 * GB)
    assert available_bytes() == 4 * GB


def test_committed_storage_counts_against_available(user, r2_cap):
    _store(2 * GB, "a" * 64)  # a real stored blob
    assert available_bytes() == 8 * GB


def test_commit_marks_reservation_committed(user, r2_cap):
    res = reserve(user, size_bytes=2 * GB)
    commit(res)
    user.refresh_from_db()
    assert user.storage_used_bytes == 2 * GB  # per-user counter still maintained
    res.refresh_from_db()
    assert res.status == StorageReservation.Status.COMMITTED


def test_commit_is_idempotent(user, r2_cap):
    res = reserve(user, size_bytes=2 * GB)
    commit(res)
    commit(res)  # second commit is a no-op
    user.refresh_from_db()
    assert user.storage_used_bytes == 2 * GB


def test_reserve_rejects_file_over_per_file_cap(user):
    with pytest.raises(FileTooLarge):
        reserve(user, size_bytes=MAX_FILE_BYTES + 1)


def test_expired_reservations_release_quota(user, r2_cap):
    from datetime import timedelta

    from django.utils import timezone
    res = reserve(user, size_bytes=4 * GB)
    assert available_bytes() == 6 * GB
    # Force-expire it.
    res.expires_at = timezone.now() - timedelta(minutes=1)
    res.save(update_fields=["expires_at"])
    assert available_bytes() == 10 * GB  # expired reservations don't count
    assert release_expired() == 1
    res.refresh_from_db()
    assert res.status == StorageReservation.Status.EXPIRED

"""TDD spec for reserve-then-commit quota (the TOCTOU-safe path, PRD 5.3)."""
import pytest
from django.contrib.auth import get_user_model

from apps.storage.models import MAX_FILE_BYTES, StorageReservation
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
    # quota_bytes is set small to make the GB-scale quota math readable (well
    # under the 20GB per-file cap so reservations exercise quota, not the cap).
    u = User.objects.create_user(email="q@floppy.disk", password="hunter2pass")
    u.quota_bytes = 10 * GB
    u.storage_used_bytes = 0
    u.save()
    return u


def test_available_starts_at_full_quota(user):
    assert available_bytes(user) == 10 * GB


def test_reserve_reduces_available_before_commit(user):
    reserve(user, size_bytes=3 * GB)
    # Reservation is live but not yet committed -> available reflects it.
    assert available_bytes(user) == 7 * GB
    user.refresh_from_db()
    assert user.storage_used_bytes == 0  # not committed yet


def test_concurrent_reservations_cannot_exceed_quota(user):
    reserve(user, size_bytes=6 * GB)
    # A second reservation that would push past quota is rejected, even though
    # storage_used_bytes is still 0 (this is the TOCTOU race the design fixes).
    with pytest.raises(QuotaExceeded):
        reserve(user, size_bytes=5 * GB)
    assert available_bytes(user) == 4 * GB


def test_commit_moves_reservation_into_used(user):
    res = reserve(user, size_bytes=2 * GB)
    commit(res)
    user.refresh_from_db()
    assert user.storage_used_bytes == 2 * GB
    res.refresh_from_db()
    assert res.status == StorageReservation.Status.COMMITTED
    # Committed usage still counts against available (not double-counted).
    assert available_bytes(user) == 8 * GB


def test_commit_is_idempotent(user):
    res = reserve(user, size_bytes=2 * GB)
    commit(res)
    commit(res)  # second commit is a no-op
    user.refresh_from_db()
    assert user.storage_used_bytes == 2 * GB


def test_reserve_rejects_file_over_per_file_cap(user):
    with pytest.raises(FileTooLarge):
        reserve(user, size_bytes=MAX_FILE_BYTES + 1)


def test_expired_reservations_release_quota(user):
    from datetime import timedelta

    from django.utils import timezone
    res = reserve(user, size_bytes=4 * GB)
    assert available_bytes(user) == 6 * GB
    # Force-expire it.
    res.expires_at = timezone.now() - timedelta(minutes=1)
    res.save(update_fields=["expires_at"])
    assert available_bytes(user) == 10 * GB  # expired reservations don't count
    assert release_expired() == 1
    res.refresh_from_db()
    assert res.status == StorageReservation.Status.EXPIRED

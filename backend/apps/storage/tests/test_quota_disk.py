"""Disk-aware quota + usage-endpoint + reconciliation tests (the sidebar-meter fixes)."""
import collections
from io import StringIO
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APIClient

from apps.storage import quota
from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db

GB = 1024**3
DU = collections.namedtuple("DU", "total used free")


@pytest.fixture
def user(db):
    u = User.objects.create_user(email="q@floppy.disk", password="hunter2pass")
    u.quota_bytes = 2 * 1024**4  # the fictional 2 TB default
    u.storage_used_bytes = 0
    u.save()
    return u


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _ready_file(user, size, hash_):
    obj = StorageObject.objects.create(
        content_hash=hash_, region=user.storage_region, size_bytes=size,
        ref_count=1, status=StorageObject.Status.READY,
    )
    return File.objects.create(
        owner=user, name=f"{hash_[:6]}.bin", size_bytes=size, kind=File.Kind.DOC,
        status=File.Status.READY, storage_object=obj,
    )


# --- effective quota ---------------------------------------------------------
def test_explicit_override_wins(user):
    with override_settings(STORAGE_QUOTA_BYTES=100 * GB):
        assert quota.effective_quota_bytes(user) == 100 * GB


@override_settings(STORAGE_TRACK_DISK=True, STORAGE_QUOTA_BYTES=0)
def test_local_quota_capped_to_real_disk(user):
    # 500 GB disk caps the fictional 2 TB quota down to the real disk size.
    with mock.patch.object(quota, "disk_usage", return_value=DU(500 * GB, 100 * GB, 400 * GB)):
        assert quota.effective_quota_bytes(user) == 500 * GB
        assert quota.disk_free_bytes(user) == 400 * GB


@override_settings(STORAGE_TRACK_DISK=False)
def test_disk_tracking_off_uses_plain_quota(user):
    assert quota.effective_quota_bytes(user) == user.quota_bytes
    assert quota.disk_free_bytes(user) is None


# --- disk-full guard ---------------------------------------------------------
@override_settings(STORAGE_TRACK_DISK=True)
def test_reserve_rejected_when_disk_physically_full(user):
    with mock.patch.object(quota, "disk_usage", return_value=DU(500 * GB, 499 * GB, 1 * GB)):
        # 2 GB won't fit in 1 GB of real free space, even though the logical
        # quota has room.
        with pytest.raises(quota.QuotaExceeded):
            quota.reserve(user, size_bytes=2 * GB)


# --- usage endpoint ----------------------------------------------------------
@override_settings(STORAGE_TRACK_DISK=True, STORAGE_QUOTA_BYTES=0)
def test_usage_endpoint_reports_real_disk(user):
    with mock.patch.object(quota, "disk_usage", return_value=DU(500 * GB, 100 * GB, 400 * GB)):
        body = _client(user).get("/api/v1/storage/usage").json()
    assert body["quota_bytes"] == 500 * GB  # not the fictional 2 TB
    assert body["disk_free_bytes"] == 400 * GB


# --- reconciliation command --------------------------------------------------
def test_recompute_fixes_drift(user):
    _ready_file(user, 3 * GB, "a" * 64)
    _ready_file(user, 2 * GB, "b" * 64)
    # Simulate a drifted counter (say a decrement was missed).
    User.objects.filter(pk=user.pk).update(storage_used_bytes=99 * GB)

    out = StringIO()
    call_command("recompute_storage_usage", stdout=out)
    user.refresh_from_db()
    assert user.storage_used_bytes == 5 * GB  # 3 + 2, the real total
    assert "drift" in out.getvalue()


def test_recompute_counts_trashed_but_not_pending(user):
    f = _ready_file(user, 4 * GB, "c" * 64)
    f.deleted_at = f.updated_at  # trashed -> still counts until purged
    f.save(update_fields=["deleted_at"])
    # A PENDING upload is a reservation, not committed bytes -> excluded.
    _pending = File.objects.create(
        owner=user, name="pending.bin", size_bytes=7 * GB, kind=File.Kind.DOC,
        status=File.Status.PENDING,
    )
    User.objects.filter(pk=user.pk).update(storage_used_bytes=0)
    call_command("recompute_storage_usage", stdout=StringIO())
    user.refresh_from_db()
    assert user.storage_used_bytes == 4 * GB  # trashed READY counted, PENDING not


def test_recompute_dry_run_reports_without_writing(user):
    _ready_file(user, 1 * GB, "d" * 64)
    User.objects.filter(pk=user.pk).update(storage_used_bytes=50 * GB)
    call_command("recompute_storage_usage", "--dry-run", stdout=StringIO())
    user.refresh_from_db()
    assert user.storage_used_bytes == 50 * GB  # unchanged in dry-run

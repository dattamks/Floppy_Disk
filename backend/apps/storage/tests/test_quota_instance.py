"""Instance-wide quota: shared usage, R2 budget cap, and the overflow toggle.

Single-tenant model - everyone shares one storage pool, so the meter and the cap
are instance-wide, not per user. Local is bounded by the real disk; R2 is bounded
by an owner-set budget cap that can be soft (overflow on) or enforced (off).
"""
import collections
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings

from apps.storage import quota
from apps.storage.models import File, StorageConfig, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db

GB = 1024**3
TB = 1024**4
DU = collections.namedtuple("DU", "total used free")


@pytest.fixture
def two_users(db):
    a = User.objects.create_user(email="a@floppy.disk", password="pw")
    b = User.objects.create_user(email="b@floppy.disk", password="pw")
    return a, b


def _stored_object(size, hash_, ref=1, status=None):
    return StorageObject.objects.create(
        content_hash=hash_, region="ap-south", size_bytes=size, ref_count=ref,
        status=status or StorageObject.Status.READY,
    )


def _r2():
    cfg = StorageConfig.load()
    cfg.backend = StorageConfig.Backend.R2
    cfg.r2_endpoint_url = "https://x.r2.cloudflarestorage.com"
    cfg.r2_access_key_id = "k"
    cfg.r2_secret_ciphertext = "enc"
    cfg.r2_bucket = "b"
    cfg.save()
    return cfg


# --- instance-wide used (deduplicated) --------------------------------------
def test_instance_used_is_deduplicated(two_users):
    # One physical blob shared by two users' files counts ONCE.
    _stored_object(5 * GB, "a" * 64, ref=2)
    _stored_object(3 * GB, "b" * 64, ref=1)
    assert quota.instance_used_bytes() == 8 * GB


def test_instance_used_excludes_orphaned_blobs(two_users):
    _stored_object(5 * GB, "a" * 64, ref=1)
    _stored_object(9 * GB, "b" * 64, ref=0)  # orphaned (fully purged) - excluded
    assert quota.instance_used_bytes() == 5 * GB


# --- total ceiling -----------------------------------------------------------
@override_settings(STORAGE_TRACK_DISK=True, STORAGE_QUOTA_BYTES=0)
def test_total_is_real_disk_on_local(two_users):
    with mock.patch.object(quota, "disk_usage", return_value=DU(500 * GB, 100 * GB, 400 * GB)):
        assert quota.storage_total_bytes() == 500 * GB


@override_settings(STORAGE_QUOTA_BYTES=0)
def test_total_is_budget_cap_on_r2(two_users):
    cfg = _r2()
    cfg.r2_quota_bytes = 4 * TB
    cfg.save()
    assert quota.storage_total_bytes() == 4 * TB


@override_settings(STORAGE_QUOTA_BYTES=250 * GB)
def test_explicit_override_beats_everything(two_users):
    _r2()
    assert quota.storage_total_bytes() == 250 * GB


# --- R2 cap enforcement + overflow toggle -----------------------------------
@override_settings(STORAGE_QUOTA_BYTES=0)
def test_r2_cap_enforced_when_overflow_off(two_users):
    a, _ = two_users
    cfg = _r2()
    cfg.r2_quota_bytes = 10 * GB
    cfg.allow_overflow = False
    cfg.save()
    _stored_object(9 * GB, "a" * 64)  # 9 of 10 GB used
    with pytest.raises(quota.QuotaExceeded):
        quota.reserve(a, size_bytes=2 * GB)  # 9 + 2 > 10 -> blocked


@override_settings(STORAGE_QUOTA_BYTES=0)
def test_r2_overflow_on_allows_exceeding_cap(two_users):
    a, _ = two_users
    cfg = _r2()
    cfg.r2_quota_bytes = 10 * GB
    cfg.allow_overflow = True
    cfg.save()
    _stored_object(9 * GB, "a" * 64)
    res = quota.reserve(a, size_bytes=15 * GB)  # 9 + 15 well past the 10 GB cap - allowed
    assert res.bytes == 15 * GB


@override_settings(STORAGE_TRACK_DISK=True, STORAGE_QUOTA_BYTES=0)
def test_local_blocks_on_physical_disk_full(two_users):
    a, _ = two_users
    with mock.patch.object(quota, "disk_usage", return_value=DU(500 * GB, 499 * GB, 1 * GB)):
        with pytest.raises(quota.QuotaExceeded):
            quota.reserve(a, size_bytes=2 * GB)  # 2 GB won't fit in 1 GB free


@override_settings(STORAGE_QUOTA_BYTES=0)
def test_overflow_allowed_only_meaningful_for_r2(two_users):
    # local: overflow concept doesn't apply (always disk-bounded).
    with override_settings(STORAGE_TRACK_DISK=False):
        assert quota.overflow_allowed() is False
    cfg = _r2()
    cfg.allow_overflow = True
    cfg.save()
    assert quota.overflow_allowed() is True


# --- usage endpoint is instance-wide ----------------------------------------
def test_usage_endpoint_is_instance_wide(two_users):
    from rest_framework.test import APIClient

    a, b = two_users
    # Two users, one shared 6 GB blob (dedup) -> instance used is 6 GB, not 12.
    _stored_object(6 * GB, "a" * 64, ref=2)
    cfg = _r2()
    cfg.r2_quota_bytes = 100 * GB
    cfg.allow_overflow = True
    cfg.save()

    c = APIClient()
    c.force_authenticate(b)  # any member sees the same shared numbers
    body = c.get("/api/v1/storage/usage").json()
    assert body["used_bytes"] == 6 * GB
    assert body["quota_bytes"] == 100 * GB
    assert body["backend"] == "r2"
    assert body["overflow_allowed"] is True
    assert body["over_cap"] is False

"""Quota settlement at upload-complete: charge the real size, stay symmetric.

Covers the accounting bugs where committed usage could diverge from the bytes
actually stored (letting a user under-count quota) or a purge could drive
storage_used_bytes negative.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.lifecycle import purge_file
from apps.storage.models import File, StorageReservation
from apps.storage.quota import charge_usage, commit, reserve

User = get_user_model()
pytestmark = pytest.mark.django_db
GB = 1024**3


@pytest.fixture
def user(db):
    u = User.objects.create_user(email="qs@floppy.disk", password="hunter2pass")
    u.quota_bytes = 10 * GB
    u.save()
    return u


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_commit_charges_actual_not_claimed_size(user):
    res = reserve(user, size_bytes=1)          # claimed tiny
    commit(res, actual_bytes=5 * GB)           # real upload much larger
    user.refresh_from_db()
    assert user.storage_used_bytes == 5 * GB
    res.refresh_from_db()
    assert res.bytes == 5 * GB


def test_charge_usage_counts_bytes_without_reservation(user):
    charge_usage(user, 3 * GB)
    user.refresh_from_db()
    assert user.storage_used_bytes == 3 * GB


def _upload(client, name, payload, *, declared=None):
    declared = len(payload) if declared is None else declared
    init = client.post("/api/v1/storage/uploads",
                       {"name": name, "size_bytes": declared, "kind": "doc"}, format="json").json()
    client.put(init["upload"]["url"], data=payload, content_type="application/octet-stream")
    resp = client.post(f"/api/v1/storage/uploads/{init['file']['id']}/complete")
    return init["file"]["id"], resp


def test_upload_charges_real_size_when_client_underdeclares(client, user):
    """Declare 1 byte, upload many: quota must reflect the real size, not the claim."""
    payload = b"x" * 4096
    fid, resp = _upload(client, "big.txt", payload, declared=1)
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.storage_used_bytes == len(payload)


def test_complete_after_reservation_expiry_stays_symmetric(client, user):
    """If the reservation lapsed before completion, usage is still counted and a
    later purge returns exactly to zero (never negative)."""
    payload = b"y" * 2048
    init = client.post("/api/v1/storage/uploads",
                       {"name": "slow.txt", "size_bytes": len(payload), "kind": "doc"},
                       format="json").json()
    client.put(init["upload"]["url"], data=payload, content_type="application/octet-stream")
    # Force the reservation to look expired before completion.
    StorageReservation.objects.filter(file_id=init["file"]["id"]).update(
        status=StorageReservation.Status.EXPIRED
    )
    resp = client.post(f"/api/v1/storage/uploads/{init['file']['id']}/complete")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.storage_used_bytes == len(payload)

    purge_file(File.objects.get(pk=init["file"]["id"]))
    user.refresh_from_db()
    assert user.storage_used_bytes == 0


def test_purge_of_processing_video_releases_quota(user):
    """A video committed while still transcoding (PROCESSING) must refund its
    quota on purge — previously only READY files were refunded, leaking quota."""
    from apps.storage.models import StorageObject

    obj = StorageObject.objects.create(
        content_hash="c" * 64, region=user.storage_region, size_bytes=2 * GB,
        ref_count=1, status=StorageObject.Status.READY, object_key=f"{user.id}/vid",
    )
    f = File.objects.create(
        owner=user, name="clip.mov", size_bytes=2 * GB, kind=File.Kind.VIDEO,
        status=File.Status.PROCESSING, storage_object=obj,
    )
    User.objects.filter(pk=user.pk).update(storage_used_bytes=2 * GB)

    purge_file(f)
    user.refresh_from_db()
    assert user.storage_used_bytes == 0
    assert not StorageObject.objects.filter(pk=obj.pk).exists()

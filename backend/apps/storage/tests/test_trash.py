"""TDD spec for trash: soft-delete, restore, purge, and quota interaction."""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="t@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _ready_file(user, size=1000, hash_="a" * 64):
    obj = StorageObject.objects.create(
        content_hash=hash_, region=user.storage_region, size_bytes=size,
        ref_count=1, status=StorageObject.Status.READY,
    )
    return File.objects.create(
        owner=user, name="doc.txt", size_bytes=size, kind=File.Kind.DOC,
        status=File.Status.READY, storage_object=obj,
    )


def test_soft_delete_moves_file_to_trash(client, user):
    f = _ready_file(user)
    resp = client.delete(f"/api/v1/storage/files/{f.id}")
    assert resp.status_code == 204

    # gone from the normal listing...
    assert client.get("/api/v1/storage/files").json() == []
    # ...but present in trash
    trash = client.get("/api/v1/storage/trash").json()
    assert [x["name"] for x in trash["files"]] == ["doc.txt"]
    f.refresh_from_db()
    assert f.deleted_at is not None


def test_trash_still_counts_toward_quota_until_purged(client, user):
    user.storage_used_bytes = 1000
    user.save()
    f = _ready_file(user)
    client.delete(f"/api/v1/storage/files/{f.id}")
    user.refresh_from_db()
    assert user.storage_used_bytes == 1000  # unchanged by soft delete


def test_restore_brings_file_back(client, user):
    f = _ready_file(user)
    client.delete(f"/api/v1/storage/files/{f.id}")
    resp = client.post(f"/api/v1/storage/files/{f.id}/restore")
    assert resp.status_code == 200
    assert [x["name"] for x in client.get("/api/v1/storage/files").json()] == ["doc.txt"]
    assert client.get("/api/v1/storage/trash").json()["files"] == []


def test_purge_releases_quota_and_drops_ref_count(client, user):
    user.storage_used_bytes = 1000
    user.save()
    f = _ready_file(user, size=1000)
    obj_id = f.storage_object_id
    client.delete(f"/api/v1/storage/files/{f.id}")

    resp = client.post(f"/api/v1/storage/files/{f.id}/purge")
    assert resp.status_code == 204

    user.refresh_from_db()
    assert user.storage_used_bytes == 0                 # quota released
    assert not File.objects.filter(pk=f.id).exists()    # row gone
    assert not StorageObject.objects.filter(pk=obj_id).exists()  # ref_count hit 0 -> blob gone


def test_purge_keeps_blob_when_other_refs_remain(client, user):
    # Two files share one StorageObject (ref_count=2).
    obj = StorageObject.objects.create(
        content_hash="b" * 64, region=user.storage_region, size_bytes=500,
        ref_count=2, status=StorageObject.Status.READY,
    )
    f1 = File.objects.create(owner=user, name="a.txt", size_bytes=500,
                             status=File.Status.READY, storage_object=obj)
    File.objects.create(owner=user, name="b.txt", size_bytes=500,
                        status=File.Status.READY, storage_object=obj)

    client.delete(f"/api/v1/storage/files/{f1.id}")
    client.post(f"/api/v1/storage/files/{f1.id}/purge")

    obj.refresh_from_db()
    assert obj.ref_count == 1  # still referenced by b.txt -> blob kept


def test_cannot_purge_a_non_trashed_file(client, user):
    f = _ready_file(user)
    resp = client.post(f"/api/v1/storage/files/{f.id}/purge")
    assert resp.status_code == 404  # must be in trash first


def test_cannot_restore_a_cascaded_subfolder_directly(client, user):
    """A subfolder trashed via its ancestor must not be restorable on its own
    (which would orphan it under a still-trashed parent)."""
    from apps.storage.models import Folder

    parent = Folder.objects.create(owner=user, name="Parent")
    sub = Folder.objects.create(owner=user, name="Sub", parent=parent)
    client.delete(f"/api/v1/storage/folders/{parent.id}")

    sub.refresh_from_db()
    assert sub.trashed_root == parent.id  # cascaded
    # Restoring the subfolder by id is refused; it comes back with the parent.
    assert client.post(f"/api/v1/storage/folders/{sub.id}/restore").status_code == 404


def test_purge_expired_trash_job_respects_retention(user):
    from datetime import timedelta

    from apps.storage.lifecycle import purge_expired_trash

    old = _ready_file(user, hash_="c" * 64)
    old.deleted_at = timezone.now() - timedelta(days=8)  # past 7-day free retention
    old.save()
    recent = _ready_file(user, hash_="d" * 64)
    recent.deleted_at = timezone.now() - timedelta(days=1)
    recent.save()

    assert purge_expired_trash() == 1
    assert not File.objects.filter(pk=old.id).exists()
    assert File.objects.filter(pk=recent.id).exists()

"""TDD spec for the storage API: folders, files, and the upload flow."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File, Folder, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db
GB = 1024**3


@pytest.fixture
def user(db):
    return User.objects.create_user(email="s@floppy.disk", password="hunter2pass")


@pytest.fixture
def other(db):
    return User.objects.create_user(email="other@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


# --- folders ----------------------------------------------------------------

def test_create_and_list_folder(client, user):
    resp = client.post("/api/v1/storage/folders", {"name": "Photos"}, format="json")
    assert resp.status_code == 201, resp.content
    assert resp.json()["name"] == "Photos"

    listing = client.get("/api/v1/storage/folders")
    assert listing.status_code == 200
    names = [f["name"] for f in listing.json()]
    assert names == ["Photos"]


def test_nested_folder_listing_by_parent(client, user):
    parent = client.post("/api/v1/storage/folders", {"name": "Root"}, format="json").json()
    client.post("/api/v1/storage/folders", {"name": "Child", "parent": parent["id"]}, format="json")

    top = client.get("/api/v1/storage/folders").json()
    assert [f["name"] for f in top] == ["Root"]
    children = client.get(f"/api/v1/storage/folders?parent={parent['id']}").json()
    assert [f["name"] for f in children] == ["Child"]


def test_cannot_nest_under_another_users_folder(client, other):
    foreign = Folder.objects.create(owner=other, name="Foreign")
    resp = client.post("/api/v1/storage/folders", {"name": "X", "parent": str(foreign.id)}, format="json")
    assert resp.status_code == 400


def test_delete_folder_soft_deletes(client, user):
    folder = client.post("/api/v1/storage/folders", {"name": "Temp"}, format="json").json()
    resp = client.delete(f"/api/v1/storage/folders/{folder['id']}")
    assert resp.status_code == 204
    assert client.get("/api/v1/storage/folders").json() == []
    assert Folder.objects.get(id=folder["id"]).deleted_at is not None


def test_folders_are_owner_scoped(client, other):
    Folder.objects.create(owner=other, name="NotYours")
    assert client.get("/api/v1/storage/folders").json() == []


def test_folder_requires_auth():
    assert APIClient().get("/api/v1/storage/folders").status_code == 403


# --- upload flow ------------------------------------------------------------

def test_full_upload_flow_commits_quota_and_dedups(client, user):
    payload = b"hello floppy disk" * 100
    # 1. initiate
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": "note.txt", "size_bytes": len(payload), "kind": "doc"},
        format="json",
    )
    assert init.status_code == 201, init.content
    body = init.json()
    file_id = body["file"]["id"]
    upload_url = body["upload"]["url"]
    assert body["file"]["status"] == "pending"

    # 2. upload the bytes to the (dev) presigned URL
    put = client.put(upload_url, data=payload, content_type="application/octet-stream")
    assert put.status_code == 204

    # 3. complete
    done = client.post(f"/api/v1/storage/uploads/{file_id}/complete")
    assert done.status_code == 200, done.content
    assert done.json()["status"] == "ready"

    user.refresh_from_db()
    assert user.storage_used_bytes == len(payload)  # committed
    assert StorageObject.objects.count() == 1
    assert StorageObject.objects.first().ref_count == 1

    # file now appears in listing
    files = client.get("/api/v1/storage/files").json()
    assert [f["name"] for f in files] == ["note.txt"]


def test_upload_initiate_blocks_when_over_quota(client, user):
    user.quota_bytes = 5 * GB
    user.storage_used_bytes = 4 * GB
    user.save()
    resp = client.post(
        "/api/v1/storage/uploads",
        {"name": "big.bin", "size_bytes": 2 * GB},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "quota_exceeded"
    # no orphan File left behind
    assert File.objects.filter(owner=user).count() == 0


def test_upload_initiate_blocks_file_over_cap(client, user):
    resp = client.post(
        "/api/v1/storage/uploads",
        {"name": "huge.bin", "size_bytes": 21 * GB},  # > 20GB per-file cap
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "file_too_large"


def test_usage_endpoint_reports_quota(client, user):
    resp = client.get("/api/v1/storage/usage")
    assert resp.status_code == 200
    data = resp.json()
    assert data["quota_bytes"] == user.quota_bytes
    assert data["used_bytes"] == 0


def test_malformed_folder_param_does_not_500(client):
    """A non-UUID ?folder=/?parent= must return an empty list, never crash."""
    assert client.get("/api/v1/storage/files?folder=not-a-uuid").status_code == 200
    assert client.get("/api/v1/storage/files?folder=not-a-uuid").json() == []
    assert client.get("/api/v1/storage/folders?parent=%2E%2E%2Fetc").status_code == 200
    assert client.get("/api/v1/storage/folders?parent=12345").json() == []

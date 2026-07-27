"""Rename + move + name-collision handling for files and folders (Drive-style)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File, Folder, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="ops@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _folder(user, name, parent=None):
    return Folder.objects.create(owner=user, name=name, parent=parent)


def _file(user, name, folder=None):
    import uuid
    h = uuid.uuid4().hex.ljust(64, "0")[:64]
    obj = StorageObject.objects.create(
        content_hash=h, region=user.storage_region,
        size_bytes=1, ref_count=1, status=StorageObject.Status.READY, object_key=f"{user.id}/{h}",
    )
    return File.objects.create(owner=user, name=name, size_bytes=1, kind=File.Kind.FILE,
                               status=File.Status.READY, storage_object=obj, folder=folder)


# --- folder rename / move ---------------------------------------------------
def test_rename_folder(client, user):
    f = _folder(user, "Old")
    resp = client.patch(f"/api/v1/storage/folders/{f.id}", {"name": "New"}, format="json")
    assert resp.status_code == 200, resp.content
    assert resp.json()["name"] == "New"
    f.refresh_from_db()
    assert f.name == "New"


def test_move_folder_into_another(client, user):
    parent = _folder(user, "Parent")
    child = _folder(user, "Child")
    resp = client.patch(f"/api/v1/storage/folders/{child.id}", {"parent": str(parent.id)}, format="json")
    assert resp.status_code == 200, resp.content
    child.refresh_from_db()
    assert child.parent_id == parent.id


def test_cannot_move_folder_into_itself(client, user):
    f = _folder(user, "Self")
    resp = client.patch(f"/api/v1/storage/folders/{f.id}", {"parent": str(f.id)}, format="json")
    assert resp.status_code == 400


def test_cannot_move_folder_into_its_descendant(client, user):
    a = _folder(user, "A")
    b = _folder(user, "B", parent=a)
    # Moving A under its own child B would create a cycle.
    resp = client.patch(f"/api/v1/storage/folders/{a.id}", {"parent": str(b.id)}, format="json")
    assert resp.status_code == 400


def test_move_folder_to_invalid_parent(client, user):
    other = User.objects.create_user(email="x@floppy.disk", password="hunter2pass")
    foreign = _folder(other, "Theirs")
    mine = _folder(user, "Mine")
    resp = client.patch(f"/api/v1/storage/folders/{mine.id}", {"parent": str(foreign.id)}, format="json")
    assert resp.status_code == 400


# --- file rename / move -----------------------------------------------------
def test_rename_file(client, user):
    f = _file(user, "a.txt")
    resp = client.patch(f"/api/v1/storage/files/{f.id}", {"name": "b.txt"}, format="json")
    assert resp.status_code == 200, resp.content
    assert resp.json()["name"] == "b.txt"


def test_move_file_into_and_out_of_folder(client, user):
    dest = _folder(user, "Dest")
    f = _file(user, "doc.pdf")
    r1 = client.patch(f"/api/v1/storage/files/{f.id}", {"folder": str(dest.id)}, format="json")
    assert r1.status_code == 200, r1.content
    f.refresh_from_db()
    assert f.folder_id == dest.id
    # move back to root
    r2 = client.patch(f"/api/v1/storage/files/{f.id}", {"folder": None}, format="json")
    assert r2.status_code == 200
    f.refresh_from_db()
    assert f.folder_id is None


# --- name-collision handling ------------------------------------------------
def test_create_folder_collision_autosuffixes(client, user):
    _folder(user, "Reports")
    resp = client.post("/api/v1/storage/folders", {"name": "Reports"}, format="json")
    assert resp.status_code == 201
    assert resp.json()["name"] == "Reports (2)"


def test_rename_folder_collision_autosuffixes(client, user):
    _folder(user, "Taken")
    other = _folder(user, "Other")
    resp = client.patch(f"/api/v1/storage/folders/{other.id}", {"name": "Taken"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Taken (2)"


def test_move_file_collision_autosuffixes(client, user):
    dest = _folder(user, "Dest")
    _file(user, "report.pdf", folder=dest)  # already there
    moving = _file(user, "report.pdf")       # at root
    resp = client.patch(f"/api/v1/storage/files/{moving.id}", {"folder": str(dest.id)}, format="json")
    assert resp.status_code == 200
    # Extension preserved when de-duping.
    assert resp.json()["name"] == "report (2).pdf"


def test_restore_folder_into_reused_name_gets_variant(client, user):
    """The scenario: make X, delete X, make a new X, then restore the old one."""
    x1 = _folder(user, "Projects")
    client.delete(f"/api/v1/storage/folders/{x1.id}")  # trash it
    _folder(user, "Projects")                           # reuse the name
    resp = client.post(f"/api/v1/storage/folders/{x1.id}/restore")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Projects (2)"        # restored under a variant
    assert Folder.objects.filter(owner=user, deleted_at__isnull=True, name__startswith="Projects").count() == 2


def test_purge_folder_removes_subtree_and_releases_quota(client, user):
    """Permanently deleting a trashed folder purges every file under it."""
    from apps.storage.models import Folder

    parent = _folder(user, "Big")
    sub = _folder(user, "Sub", parent=parent)
    f1 = _file(user, "a.txt", folder=parent)
    f2 = _file(user, "b.txt", folder=sub)
    # Pretend the files hold committed quota.
    User.objects.filter(pk=user.pk).update(storage_used_bytes=2)
    File.objects.filter(pk__in=[f1.pk, f2.pk]).update(size_bytes=1, status=File.Status.READY)

    client.delete(f"/api/v1/storage/folders/{parent.id}")  # trash the parent
    resp = client.post(f"/api/v1/storage/folders/{parent.id}/purge")
    assert resp.status_code == 204, resp.content

    assert not Folder.objects.filter(pk__in=[parent.pk, sub.pk]).exists()
    assert not File.objects.filter(pk__in=[f1.pk, f2.pk]).exists()
    user.refresh_from_db()
    assert user.storage_used_bytes == 0  # quota released for both files


def test_cannot_purge_a_non_trashed_folder(client, user):
    f = _folder(user, "Live")
    assert client.post(f"/api/v1/storage/folders/{f.id}/purge").status_code == 404


def test_cannot_purge_another_users_folder(client, user):
    other = User.objects.create_user(email="z@floppy.disk", password="hunter2pass")
    foreign = _folder(other, "Theirs")
    foreign.deleted_at = foreign.updated_at
    foreign.save(update_fields=["deleted_at"])
    assert client.post(f"/api/v1/storage/folders/{foreign.id}/purge").status_code == 404


def test_restore_file_into_reused_name_gets_variant(client, user):
    a = _file(user, "notes.md")
    client.delete(f"/api/v1/storage/files/{a.id}")
    _file(user, "notes.md")
    resp = client.post(f"/api/v1/storage/files/{a.id}/restore")
    assert resp.status_code == 200
    assert resp.json()["name"] == "notes (2).md"

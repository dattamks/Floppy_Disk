"""Edit-in-place: replacing a text file's content (PUT /files/{id}/content)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="ed@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _upload_text(client, name, body):
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(body), "kind": "doc"},
        format="json",
    ).json()
    client.put(init["upload"]["url"], data=body, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{init['file']['id']}/complete")
    return init["file"]["id"]


def test_edit_replaces_content_and_updates_size_and_quota(client, user, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    fid = _upload_text(client, "notes.md", b"hello")
    user.refresh_from_db()
    used_before = user.storage_used_bytes

    resp = client.put(f"/api/v1/storage/files/{fid}/content",
                      {"content": "hello, world!"}, format="json")
    assert resp.status_code == 200, resp.content
    assert resp.json()["size_bytes"] == len("hello, world!")

    f = File.objects.select_related("storage_object").get(pk=fid)
    assert f.size_bytes == len("hello, world!")
    # The bytes served back reflect the edit.
    obj = f.storage_object
    url = f"/api/v1/storage/_dev/blob/{obj.region}/{obj.object_key}"
    assert b"".join(client.get(url).streaming_content) == b"hello, world!"
    # Quota tracked the +8 byte delta.
    user.refresh_from_db()
    assert user.storage_used_bytes == used_before + (len("hello, world!") - len("hello"))


def test_edit_releases_the_old_blob(client, user, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    fid = _upload_text(client, "a.txt", b"first version")
    old_obj_id = File.objects.get(pk=fid).storage_object_id

    client.put(f"/api/v1/storage/files/{fid}/content", {"content": "second version"}, format="json")
    f = File.objects.get(pk=fid)
    assert f.storage_object_id != old_obj_id
    # The old, now-unreferenced blob is gone.
    assert not StorageObject.objects.filter(pk=old_obj_id).exists()


def test_cannot_edit_another_users_file(client, user):
    other = User.objects.create_user(email="x@floppy.disk", password="hunter2pass")
    obj = StorageObject.objects.create(content_hash="a" * 64, region=other.storage_region,
                                       size_bytes=3, ref_count=1, status=StorageObject.Status.READY)
    foreign = File.objects.create(owner=other, name="x.txt", size_bytes=3, kind=File.Kind.DOC,
                                  status=File.Status.READY, storage_object=obj)
    assert client.put(f"/api/v1/storage/files/{foreign.id}/content",
                      {"content": "nope"}, format="json").status_code == 404

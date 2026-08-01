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


def test_large_note_body_survives_request_body_cap(client, user, settings, tmp_path):
    """A note between Django's old 2.5MB body cap and the 5MB edit cap must save.

    DATA_UPLOAD_MAX_MEMORY_SIZE defaults to 2.5MB, which would 400 a ~3MB note
    JSON body before the view's own 5MB limit ever applied. We raise the body cap
    to 8MB so the view-level limit is what actually governs.
    """
    settings.DEV_STORAGE_DIR = str(tmp_path)
    fid = _upload_text(client, "big.md", b"seed")
    big = "x" * (3 * 1024 * 1024)  # 3 MB: over 2.5MB, under the 5MB edit cap
    resp = client.put(f"/api/v1/storage/files/{fid}/content",
                      {"content": big}, format="json")
    assert resp.status_code == 200, resp.content
    assert resp.json()["size_bytes"] == len(big)


def test_note_over_edit_cap_is_rejected(client, user, settings, tmp_path):
    """Still bounded: a body past the 5MB inline-edit cap is refused cleanly."""
    settings.DEV_STORAGE_DIR = str(tmp_path)
    settings.DATA_UPLOAD_MAX_MEMORY_SIZE = 16 * 1024 * 1024  # let it reach the view
    fid = _upload_text(client, "huge.md", b"seed")
    too_big = "y" * (5 * 1024 * 1024 + 1)
    resp = client.put(f"/api/v1/storage/files/{fid}/content",
                      {"content": too_big}, format="json")
    assert resp.status_code == 400
    assert resp.json()["code"] == "file_too_large"


def test_cannot_edit_another_users_file(client, user):
    other = User.objects.create_user(email="x@floppy.disk", password="hunter2pass")
    obj = StorageObject.objects.create(content_hash="a" * 64, region=other.storage_region,
                                       size_bytes=3, ref_count=1, status=StorageObject.Status.READY)
    foreign = File.objects.create(owner=other, name="x.txt", size_bytes=3, kind=File.Kind.DOC,
                                  status=File.Status.READY, storage_object=obj)
    assert client.put(f"/api/v1/storage/files/{foreign.id}/content",
                      {"content": "nope"}, format="json").status_code == 404

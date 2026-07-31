"""Regression: content-addressed dedup must not break owner blob delivery.

When two users upload identical content, the second user's File reuses the
first's StorageObject (whose object_key stays under the first uploader). The
second user must still be able to download THEIR file over the local blob path,
and a user who owns no File for a key must still be refused.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File

User = get_user_model()
pytestmark = pytest.mark.django_db


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _upload(client, content: bytes, name):
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(content), "kind": "doc"},
        format="json",
    ).json()
    fid = init["file"]["id"]
    client.put(init["upload"]["url"], data=content, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{fid}/complete")
    return fid


def test_second_owner_can_download_deduped_file():
    a = User.objects.create_user(email="a@floppy.disk", password="hunter2pass")
    b = User.objects.create_user(email="b@floppy.disk", password="hunter2pass")
    content = b"shared identical bytes across two accounts"

    a_fid = _upload(_client(a), content, "a.txt")
    cb = _client(b)
    b_fid = _upload(cb, content, "b.txt")

    # Dedup really happened: both files point at the same StorageObject.
    a_obj = File.objects.get(pk=a_fid).storage_object_id
    b_obj = File.objects.get(pk=b_fid).storage_object_id
    assert a_obj == b_obj and a_obj is not None

    # B downloads B's file - the object_key is under A's namespace, but B owns a
    # File referencing it, so delivery must succeed with the real bytes.
    dl = cb.get(f"/api/v1/storage/files/{b_fid}/download").json()
    resp = cb.get(dl["download_url"])
    assert resp.status_code == 200, resp.content
    body = b"".join(resp.streaming_content) if resp.streaming else resp.getvalue()
    assert body == content


def test_stranger_cannot_read_key_they_own_no_file_for():
    a = User.objects.create_user(email="a2@floppy.disk", password="hunter2pass")
    c = User.objects.create_user(email="c2@floppy.disk", password="hunter2pass")
    a_fid = _upload(_client(a), b"private to A", "a.txt")
    obj_key = File.objects.get(pk=a_fid).storage_object.object_key
    # C owns no file referencing A's key -> refused.
    resp = _client(c).get(f"/api/v1/storage/_dev/blob/ap-south/{obj_key}")
    assert resp.status_code == 404


def test_blob_is_same_origin_frameable_for_pdf_preview():
    """The in-app PDF reader embeds the blob in a same-origin <iframe>. The
    site-wide X-Frame-Options: DENY would blank it, so the local blob response
    must send SAMEORIGIN instead."""
    a = User.objects.create_user(email="framer@floppy.disk", password="pw")
    ca = _client(a)
    fid = _upload(ca, b"%PDF-1.4 fake pdf bytes", "report.pdf")
    dl = ca.get(f"/api/v1/storage/files/{fid}/download").json()
    resp = ca.get(dl["download_url"])
    assert resp.status_code == 200
    assert resp.headers.get("X-Frame-Options") == "SAMEORIGIN"

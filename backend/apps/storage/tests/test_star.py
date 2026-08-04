"""Starring a file must persist server-side (it was previously client-only)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _upload(client, content=b"hi", name="note.txt"):
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(content), "kind": "doc"},
        format="json",
    ).json()
    fid = init["file"]["id"]
    client.put(init["upload"]["url"], data=content, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{fid}/complete")
    return fid


def test_new_file_is_not_starred(db):
    u = User.objects.create_user(email="s1@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c)
    row = next(f for f in c.get("/api/v1/storage/files").json() if f["id"] == fid)
    assert row["starred"] is False


def test_star_persists_via_patch(db):
    u = User.objects.create_user(email="s2@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c)

    resp = c.patch(f"/api/v1/storage/files/{fid}", {"starred": True}, format="json")
    assert resp.status_code == 200, resp.content
    assert resp.json()["starred"] is True

    # A fresh read (as the file listing would do on reload) still shows it starred.
    row = next(f for f in c.get("/api/v1/storage/files").json() if f["id"] == fid)
    assert row["starred"] is True

    # And it can be unstarred.
    resp = c.patch(f"/api/v1/storage/files/{fid}", {"starred": False}, format="json")
    assert resp.json()["starred"] is False


def test_star_does_not_disturb_name_or_folder(db):
    u = User.objects.create_user(email="s3@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c, name="keep.txt")
    c.patch(f"/api/v1/storage/files/{fid}", {"starred": True}, format="json")
    row = next(f for f in c.get("/api/v1/storage/files").json() if f["id"] == fid)
    assert row["name"] == "keep.txt"  # starring must not rename or move
    assert row["folder"] is None

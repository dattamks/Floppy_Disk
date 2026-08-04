"""Bulk-download a mixed selection of files and folders as one .zip."""
import io
import zipfile

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def client(db):
    u = User.objects.create_user(email="bulk@floppy.disk", password="pw")
    c = APIClient()
    c.force_authenticate(u)
    return c


def _folder(client, name, parent=None):
    body = {"name": name}
    if parent:
        body["parent"] = parent
    return client.post("/api/v1/storage/folders", body, format="json").json()["id"]


def _upload(client, name, content, folder=None):
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(content), "kind": "doc", **({"folder": folder} if folder else {})},
        format="json",
    ).json()
    fid = init["file"]["id"]
    client.put(init["upload"]["url"], data=content, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{fid}/complete")
    return fid


def test_bulk_download_mixed_selection(client, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    f1 = _upload(client, "a.txt", b"aaa")
    f2 = _upload(client, "b.txt", b"bbb")
    folder = _folder(client, "Docs")
    _upload(client, "spec.md", b"# spec", folder=folder)

    resp = client.get(f"/api/v1/storage/download?ids={f1},{f2},{folder}")
    assert resp.status_code == 200, resp.content
    assert resp["Content-Type"] == "application/zip"

    data = b"".join(resp.streaming_content)
    zf = zipfile.ZipFile(io.BytesIO(data))
    assert sorted(zf.namelist()) == ["Docs/spec.md", "a.txt", "b.txt"]
    assert zf.read("a.txt") == b"aaa"
    assert zf.read("Docs/spec.md") == b"# spec"


def test_bulk_download_single_file_still_zips(client, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    f1 = _upload(client, "solo.txt", b"solo")
    resp = client.get(f"/api/v1/storage/download?ids={f1}")
    assert resp.status_code == 200, resp.content
    data = b"".join(resp.streaming_content)
    zf = zipfile.ZipFile(io.BytesIO(data))
    assert zf.namelist() == ["solo.txt"]


def test_bulk_download_ignores_other_users_ids(client, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    mine = _upload(client, "mine.txt", b"mine")

    other = User.objects.create_user(email="intruder@floppy.disk", password="pw")
    oc = APIClient()
    oc.force_authenticate(other)
    theirs = _upload(oc, "theirs.txt", b"secret")

    resp = client.get(f"/api/v1/storage/download?ids={mine},{theirs}")
    assert resp.status_code == 200, resp.content
    data = b"".join(resp.streaming_content)
    zf = zipfile.ZipFile(io.BytesIO(data))
    # Only my file made it in; the intruder's id was silently skipped.
    assert zf.namelist() == ["mine.txt"]


def test_bulk_download_requires_at_least_one_valid_id(client):
    assert client.get("/api/v1/storage/download?ids=").status_code == 400
    assert client.get("/api/v1/storage/download").status_code == 400


def test_bulk_download_dedupes_colliding_names(client, settings, tmp_path):
    """Two folders can each hold a top-level file of the same name; the zip must
    not silently drop one to a duplicate arcname."""
    settings.DEV_STORAGE_DIR = str(tmp_path)
    a = _folder(client, "A")
    b = _folder(client, "B")
    _upload(client, "notes.txt", b"from A", folder=a)
    _upload(client, "notes.txt", b"from B", folder=b)

    resp = client.get(f"/api/v1/storage/download?ids={a},{b}")
    data = b"".join(resp.streaming_content)
    zf = zipfile.ZipFile(io.BytesIO(data))
    # Distinct arcnames, no collision.
    names = zf.namelist()
    assert len(names) == len(set(names)) == 2

"""Download a whole folder as a .zip (recursively, preserving structure)."""
import io
import zipfile

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def client(db):
    u = User.objects.create_user(email="zip@floppy.disk", password="pw")
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


def test_download_folder_returns_zip_with_nested_structure(client, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    top = _folder(client, "Project")
    sub = _folder(client, "Docs", parent=top)
    _upload(client, "readme.txt", b"hello", folder=top)
    _upload(client, "spec.md", b"# spec", folder=sub)

    resp = client.get(f"/api/v1/storage/folders/{top}/download")
    assert resp.status_code == 200, resp.content
    assert resp["Content-Type"] == "application/zip"
    assert "Project.zip" in resp.get("Content-Disposition", "")

    data = b"".join(resp.streaming_content)
    zf = zipfile.ZipFile(io.BytesIO(data))
    assert sorted(zf.namelist()) == ["Docs/spec.md", "readme.txt"]
    assert zf.read("readme.txt") == b"hello"
    assert zf.read("Docs/spec.md") == b"# spec"


def test_cannot_download_another_users_folder(client, db):
    other = User.objects.create_user(email="other@floppy.disk", password="pw")
    oc = APIClient()
    oc.force_authenticate(other)
    fid = _folder(oc, "Private")
    # A different user cannot zip it.
    assert client.get(f"/api/v1/storage/folders/{fid}/download").status_code == 404

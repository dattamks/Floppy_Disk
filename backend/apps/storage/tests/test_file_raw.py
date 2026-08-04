"""GET /files/{id}/raw -> a stable inline URL (used for grid thumbnails)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def client(db):
    u = User.objects.create_user(email="raw@floppy.disk", password="pw")
    c = APIClient()
    c.force_authenticate(u)
    return c


def _upload(client, name, content):
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(content), "kind": "image", "content_type": "image/png"},
        format="json",
    ).json()
    fid = init["file"]["id"]
    client.put(init["upload"]["url"], data=content, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{fid}/complete")
    return fid


def test_raw_redirects_to_inline_bytes(client, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    fid = _upload(client, "pic.png", b"\x89PNG\r\n\x1a\n")
    resp = client.get(f"/api/v1/storage/files/{fid}/raw")
    assert resp.status_code in (301, 302)
    # Inline (no forced attachment), pointing at the object's bytes.
    loc = resp.headers["Location"]
    assert "dl=" not in loc  # not an attachment
    assert "/_dev/blob/" in loc or loc.startswith("http")  # local blob or presigned


def test_raw_404_for_another_users_file(client, db):
    other = User.objects.create_user(email="other@floppy.disk", password="pw")
    oc = APIClient()
    oc.force_authenticate(other)
    fid = _upload(oc, "secret.png", b"\x89PNG\r\n\x1a\n")
    assert client.get(f"/api/v1/storage/files/{fid}/raw").status_code == 404

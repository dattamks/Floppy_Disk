"""Downloads must save with the file's display name, not the opaque object key."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _upload(client, content, name):
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(content), "kind": "doc"},
        format="json",
    ).json()
    fid = init["file"]["id"]
    client.put(init["upload"]["url"], data=content, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{fid}/complete")
    return fid


def test_download_button_sets_display_name(client=None):
    a = User.objects.create_user(email="dl@floppy.disk", password="pw")
    ca = _client(a)
    fid = _upload(ca, b"report bytes", "Quarterly Report.pdf")

    # The download button asks for ?download=1 -> URL carries ?dl=<name>.
    dl = ca.get(f"/api/v1/storage/files/{fid}/download?download=1").json()
    assert "dl=" in dl["download_url"]
    resp = ca.get(dl["download_url"])
    assert resp.status_code == 200
    cd = resp.headers.get("Content-Disposition", "")
    assert "attachment" in cd
    assert "Quarterly Report.pdf" in cd  # the display name, not the UUID key


def test_preview_url_stays_inline(client=None):
    a = User.objects.create_user(email="pv@floppy.disk", password="pw")
    ca = _client(a)
    fid = _upload(ca, b"%PDF-1.4 x", "doc.pdf")

    # No ?download -> served inline (no attachment) so previews render in-page.
    dl = ca.get(f"/api/v1/storage/files/{fid}/download").json()
    assert "dl=" not in dl["download_url"]
    resp = ca.get(dl["download_url"])
    assert "attachment" not in resp.headers.get("Content-Disposition", "")

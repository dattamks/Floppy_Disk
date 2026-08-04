"""Profile avatar: upload a (small, client-resized) image, fetch it, remove it."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db

# A 1x1 PNG as a data URL (what the client sends after canvas-resizing).
PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


@pytest.fixture
def client(db):
    u = User.objects.create_user(email="av@floppy.disk", password="pw")
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_set_and_read_avatar(client):
    resp = client.patch("/api/v1/auth/account/avatar", {"avatar": PNG_DATA_URL}, format="json")
    assert resp.status_code == 200, resp.content
    assert client.get("/api/v1/auth/me").json()["avatar_url"] == PNG_DATA_URL


def test_avatar_rejects_non_image_data(client):
    resp = client.patch("/api/v1/auth/account/avatar", {"avatar": "data:text/html;base64,PHNjcmlwdD4="}, format="json")
    assert resp.status_code == 400


def test_avatar_rejects_svg(client):
    # SVG can carry markup; only raster image types are allowed.
    svg = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
    resp = client.patch("/api/v1/auth/account/avatar", {"avatar": svg}, format="json")
    assert resp.status_code == 400


@pytest.mark.parametrize("mime", ["png", "jpeg", "gif", "webp"])
def test_avatar_accepts_common_raster_types(client, mime):
    data_url = f"data:image/{mime};base64,AAAA"
    resp = client.patch("/api/v1/auth/account/avatar", {"avatar": data_url}, format="json")
    assert resp.status_code == 200, resp.content


def test_avatar_rejects_oversized(client):
    big = "data:image/png;base64," + ("A" * (400 * 1024))  # ~400KB of base64
    resp = client.patch("/api/v1/auth/account/avatar", {"avatar": big}, format="json")
    assert resp.status_code == 400


def test_avatar_can_be_removed(client):
    client.patch("/api/v1/auth/account/avatar", {"avatar": PNG_DATA_URL}, format="json")
    resp = client.delete("/api/v1/auth/account/avatar")
    assert resp.status_code == 200
    assert client.get("/api/v1/auth/me").json()["avatar_url"] == ""


def test_language_preference_persists(client):
    resp = client.patch("/api/v1/auth/account/settings", {"language": "es"}, format="json")
    assert resp.status_code == 200, resp.content
    assert client.get("/api/v1/auth/me").json()["language"] == "es"

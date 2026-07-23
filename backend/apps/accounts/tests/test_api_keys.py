"""TDD spec for programmatic API-key auth + key management + file download.

Covers the backend prerequisites for the MCP server: Bearer-token auth
(bypassing CSRF), key create/list/revoke, and the owner file-download URL.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import ApiKey

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="api@floppy.disk", password="hunter2pass")


@pytest.fixture
def other(db):
    return User.objects.create_user(email="other@floppy.disk", password="hunter2pass")


def _bearer(token):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


# --- Bearer authentication --------------------------------------------------

def test_bearer_token_authenticates(user):
    _, token = ApiKey.create_for(user, name="cli")
    resp = _bearer(token).get("/api/v1/auth/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == user.email


def test_invalid_bearer_token_rejected(user):
    resp = _bearer("fd_not-a-real-token").get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)


def test_revoked_key_is_rejected(user):
    key, token = ApiKey.create_for(user, name="cli")
    key.revoked = True
    key.save(update_fields=["revoked"])
    resp = _bearer(token).get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)


def test_bearer_bypasses_csrf_on_unsafe_method(user):
    """A Bearer client carries no CSRF cookie; unsafe methods must still work."""
    _, token = ApiKey.create_for(user, name="cli")
    c = APIClient(enforce_csrf_checks=True)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    resp = c.post("/api/v1/storage/folders", {"name": "ViaToken"}, format="json")
    assert resp.status_code == 201, resp.content
    assert resp.json()["name"] == "ViaToken"


def test_bearer_updates_last_used(user):
    key, token = ApiKey.create_for(user, name="cli")
    assert key.last_used_at is None
    _bearer(token).get("/api/v1/auth/me")
    key.refresh_from_db()
    assert key.last_used_at is not None


def test_only_key_hash_is_stored(user):
    _, token = ApiKey.create_for(user, name="cli")
    key = ApiKey.objects.get(prefix=token[:12])
    assert key.key_hash != token
    assert key.key_hash == ApiKey.hash_token(token)


# --- Key management endpoints -----------------------------------------------

def _session(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_create_key_returns_full_token_once(user):
    c = _session(user)
    resp = c.post("/api/v1/auth/api-keys", {"name": "n8n"}, format="json")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["key"].startswith("fd_")
    assert body["name"] == "n8n"
    # the listing never echoes the secret back
    listing = c.get("/api/v1/auth/api-keys").json()
    assert len(listing) == 1
    assert "key" not in listing[0]
    assert listing[0]["prefix"] == body["prefix"]


def test_revoke_key(user):
    c = _session(user)
    key_id = c.post("/api/v1/auth/api-keys", {"name": "temp"}, format="json").json()["id"]
    assert c.delete(f"/api/v1/auth/api-keys/{key_id}").status_code == 204
    assert c.get("/api/v1/auth/api-keys").json() == []


def test_cannot_revoke_another_users_key(user, other):
    key, _ = ApiKey.create_for(other, name="theirs")
    resp = _session(user).delete(f"/api/v1/auth/api-keys/{key.id}")
    assert resp.status_code == 404
    key.refresh_from_db()
    assert key.revoked is False


def test_key_management_requires_auth():
    assert APIClient().get("/api/v1/auth/api-keys").status_code == 403


# --- File download ----------------------------------------------------------

def _upload_ready_file(client, name="note.txt"):
    payload = b"hello floppy disk" * 50
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(payload), "kind": "doc"},
        format="json",
    ).json()
    file_id = init["file"]["id"]
    client.put(init["upload"]["url"], data=payload, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{file_id}/complete")
    return file_id


def test_download_returns_url_for_owner(user):
    c = _session(user)
    file_id = _upload_ready_file(c)
    resp = c.get(f"/api/v1/storage/files/{file_id}/download")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["download_url"]
    assert body["name"] == "note.txt"
    assert body["size_bytes"] > 0


def test_download_via_bearer_token(user):
    session = _session(user)
    file_id = _upload_ready_file(session)
    _, token = ApiKey.create_for(user, name="cli")
    resp = _bearer(token).get(f"/api/v1/storage/files/{file_id}/download")
    assert resp.status_code == 200, resp.content
    assert resp.json()["download_url"]


def test_download_is_owner_scoped(user, other):
    file_id = _upload_ready_file(_session(user))
    resp = _session(other).get(f"/api/v1/storage/files/{file_id}/download")
    assert resp.status_code == 404

"""TDD spec for share links: create, public resolve, expiry, password, revoke."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.sharing.models import ShareLink
from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="sh@floppy.disk", password="hunter2pass")


@pytest.fixture
def paid_user(db):
    return User.objects.create_user(email="paid@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _file(owner, name="pic.jpg"):
    import uuid
    obj = StorageObject.objects.create(
        content_hash=(uuid.uuid4().hex + uuid.uuid4().hex),  # unique 64-char hash
        region=owner.storage_region, size_bytes=1234,
        ref_count=1, status=StorageObject.Status.READY, object_key=f"{owner.id}/k",
    )
    return File.objects.create(owner=owner, name=name, size_bytes=1234,
                               status=File.Status.READY, storage_object=obj)


def test_create_share_link_for_own_file(client, user):
    f = _file(user)
    resp = client.post(f"/api/v1/storage/files/{f.id}/share", {}, format="json")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["token"]
    assert body["url"].startswith("/s/")
    assert body["has_password"] is False


def test_cannot_share_another_users_file(client, paid_user):
    foreign = _file(paid_user)
    resp = client.post(f"/api/v1/storage/files/{foreign.id}/share", {}, format="json")
    assert resp.status_code == 404


def test_public_can_resolve_share_without_auth(client, user):
    f = _file(user, name="report.pdf")
    token = client.post(f"/api/v1/storage/files/{f.id}/share", {}, format="json").json()["token"]

    anon = APIClient()
    resp = anon.get(f"/api/v1/public/share/{token}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "report.pdf"
    assert body["locked"] is False
    assert "download_url" in body


def test_expired_share_returns_gone(client, user):
    f = _file(user)
    token = client.post(f"/api/v1/storage/files/{f.id}/share", {}, format="json").json()["token"]
    ShareLink.objects.filter(token=token).update(expires_at=timezone.now() - timedelta(hours=1))

    resp = APIClient().get(f"/api/v1/public/share/{token}")
    assert resp.status_code == 410


def test_unknown_token_is_404(db):
    resp = APIClient().get("/api/v1/public/share/does-not-exist")
    assert resp.status_code == 404


def test_password_share_requires_password_to_unlock(paid_user):
    c = APIClient()
    c.force_authenticate(paid_user)
    f = _file(paid_user)
    token = c.post(f"/api/v1/storage/files/{f.id}/share", {"password": "s3cret!"}, format="json").json()["token"]

    anon = APIClient()
    # GET reveals it's locked, no download url
    locked = anon.get(f"/api/v1/public/share/{token}").json()
    assert locked["locked"] is True
    assert "download_url" not in locked

    # wrong password -> 401
    assert anon.post(f"/api/v1/public/share/{token}", {"password": "nope"}, format="json").status_code == 401
    # right password -> payload with download url
    ok = anon.post(f"/api/v1/public/share/{token}", {"password": "s3cret!"}, format="json")
    assert ok.status_code == 200
    assert "download_url" in ok.json()


def test_revoke_disables_public_resolution(client, user):
    f = _file(user)
    created = client.post(f"/api/v1/storage/files/{f.id}/share", {}, format="json").json()
    token = created["token"]
    assert client.delete(f"/api/v1/storage/shares/{created['id']}").status_code == 204

    resp = APIClient().get(f"/api/v1/public/share/{token}")
    assert resp.status_code == 410  # exists but revoked


def test_share_list_is_owner_scoped(client, user, paid_user):
    _file(user)
    f = _file(user)
    client.post(f"/api/v1/storage/files/{f.id}/share", {}, format="json")
    # another user's share should not appear
    other_f = _file(paid_user)
    ShareLink.objects.create(owner=paid_user, file=other_f)

    listing = client.get("/api/v1/storage/shares").json()
    assert len(listing) == 1


def test_share_link_exposes_target_id_for_shared_view(client, user):
    """The Shared view marks files that have a live link, so the API must say
    which file each link targets (not just its name)."""
    f = _file(user, name="report.pdf")
    client.post(f"/api/v1/storage/files/{f.id}/share", {}, format="json")

    rows = client.get("/api/v1/storage/shares").json()
    assert len(rows) == 1
    assert rows[0]["target_id"] == str(f.id)
    assert rows[0]["target_name"] == "report.pdf"

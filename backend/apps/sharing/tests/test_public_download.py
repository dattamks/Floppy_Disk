"""TDD: anonymous download of a shared file's bytes (works in local mode too).

Previously the public share payload handed back a presigned URL that, in
local/no-Cloudflare mode, pointed at an auth-required dev endpoint - so a
public recipient got 403. The public download route fixes that.
"""
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.sharing.models import ShareLink
from apps.storage.models import File, StorageObject
from apps.storage.services.base import get_storage_service

User = get_user_model()
pytestmark = pytest.mark.django_db


def _ready_file(owner, name="pic.png", data=b"PNGBYTES-123"):
    obj = StorageObject.objects.create(
        content_hash=uuid.uuid4().hex + uuid.uuid4().hex,
        region=owner.storage_region, size_bytes=len(data), ref_count=1,
        status=StorageObject.Status.READY, object_key=f"{owner.id}/{uuid.uuid4().hex}",
    )
    get_storage_service().save_bytes(region=obj.region, object_key=obj.object_key, data=data)
    return File.objects.create(owner=owner, name=name, size_bytes=len(data),
                               status=File.Status.READY, storage_object=obj)


@pytest.fixture
def user(db):
    return User.objects.create_user(email="dl@floppy.disk", password="hunter2pass")


@pytest.fixture
def paid_user(db):
    return User.objects.create_user(email="paiddl@floppy.disk", password="hunter2pass")


def _share(owner, file, password=None):
    c = APIClient(); c.force_authenticate(owner)
    body = {"password": password} if password else {}
    return c.post(f"/api/v1/storage/files/{file.id}/share", body, format="json").json()["token"]


def test_anonymous_can_download_public_share_bytes(user):
    f = _ready_file(user, "pic.png", b"PNGBYTES-123")
    token = _share(user, f)

    # resolve payload gives a download_url usable without auth
    anon = APIClient()
    payload = anon.get(f"/api/v1/public/share/{token}").json()
    assert payload["download_url"]

    resp = anon.get(f"/api/v1/public/share/{token}/download")
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content) == b"PNGBYTES-123"
    assert resp["Content-Type"] == "image/png"
    assert resp["Accept-Ranges"] == "bytes"
    # Saved with the display name, not the opaque object key.
    cd = resp.headers.get("Content-Disposition", "")
    assert "attachment" in cd and "pic.png" in cd


def test_password_share_download_requires_password(paid_user):
    f = _ready_file(paid_user, "secret.pdf", b"TOPSECRET")
    token = _share(paid_user, f, password="hunter2")

    anon = APIClient()
    # no password -> rejected (token alone must not bypass the password gate)
    assert anon.get(f"/api/v1/public/share/{token}/download").status_code == 401
    # wrong password -> rejected
    assert anon.get(f"/api/v1/public/share/{token}/download?password=nope").status_code == 401
    # correct password -> bytes
    ok = anon.get(f"/api/v1/public/share/{token}/download?password=hunter2")
    assert ok.status_code == 200
    assert b"".join(ok.streaming_content) == b"TOPSECRET"


def test_revoked_share_download_is_gone(user):
    f = _ready_file(user)
    token = _share(user, f)
    ShareLink.objects.filter(token=token).update(revoked=True)
    assert APIClient().get(f"/api/v1/public/share/{token}/download").status_code == 410


def test_expired_share_download_is_gone(user):
    f = _ready_file(user)
    token = _share(user, f)
    ShareLink.objects.filter(token=token).update(expires_at=timezone.now() - timezone.timedelta(days=1))
    assert APIClient().get(f"/api/v1/public/share/{token}/download").status_code == 410


def test_unknown_share_download_is_not_found(user):
    assert APIClient().get("/api/v1/public/share/nope-nope/download").status_code == 404


def test_trashed_file_share_stops_resolving(user):
    """Soft-deleting a shared file must stop its still-active link from serving it."""
    f = _ready_file(user)
    token = _share(user, f)
    File.objects.filter(pk=f.id).update(deleted_at=timezone.now())

    anon = APIClient()
    assert anon.get(f"/api/v1/public/share/{token}").status_code == 410
    assert anon.get(f"/api/v1/public/share/{token}/download").status_code == 410

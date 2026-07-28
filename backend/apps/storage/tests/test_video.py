"""Basic video playback (Drive-style inline preview of your own files).

Self-hosted transcoding is covered in test_video_transcode.py. The old
third-party streaming platform (Cloudflare Stream/HLS) was removed.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="v@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _video(user, name="clip.mp4"):
    obj = StorageObject.objects.create(content_hash="a" * 64, region=user.storage_region,
                                       size_bytes=1000, ref_count=1,
                                       status=StorageObject.Status.READY, object_key=f"{user.id}/clip")
    return File.objects.create(owner=user, name=name, size_bytes=1000, kind=File.Kind.VIDEO,
                               status=File.Status.READY, storage_object=obj)


def test_video_plays_with_a_direct_url(client, user):
    f = _video(user)
    resp = client.post(f"/api/v1/storage/files/{f.id}/play")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["mode"] == "direct"
    assert body["url"]
    # No HD/SD tier gating — playback is a single self-hosted MP4 rendition.
    assert "max_resolution" not in body


def test_cannot_play_another_users_video(client, user):
    other = User.objects.create_user(email="o@floppy.disk", password="hunter2pass")
    foreign = _video(other)
    assert client.post(f"/api/v1/storage/files/{foreign.id}/play").status_code == 404


def test_play_requires_video_kind(client, user):
    obj = StorageObject.objects.create(content_hash="b" * 64, region=user.storage_region,
                                       size_bytes=10, ref_count=1, status=StorageObject.Status.READY)
    doc = File.objects.create(owner=user, name="x.pdf", size_bytes=10, kind=File.Kind.DOC,
                              status=File.Status.READY, storage_object=obj)
    assert client.post(f"/api/v1/storage/files/{doc.id}/play").status_code == 404


def test_storage_service_default_falls_back_without_r2(monkeypatch):
    """The env-aware default selects the local media folder when R2 is unconfigured."""
    import importlib

    import config.settings.base as base
    for var in ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.delenv("STORAGE_SERVICE", raising=False)
    reloaded = importlib.reload(base)
    try:
        assert reloaded.R2_CONFIGURED is False
        assert reloaded.STORAGE_SERVICE.endswith("LocalStorageService")
    finally:
        importlib.reload(base)  # restore


def test_local_media_delivery_supports_range(client, user, settings, tmp_path):
    """Local media endpoint serves partial content for video seeking."""
    settings.DEV_STORAGE_DIR = str(tmp_path)
    payload = b"0123456789abcdef" * 8  # 128 bytes
    init = client.post("/api/v1/storage/uploads",
                       {"name": "clip.mp4", "size_bytes": len(payload), "kind": "video"},
                       format="json").json()
    client.put(init["upload"]["url"], data=payload, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{init['file']['id']}/complete")

    url = init["upload"]["url"]  # the local blob URL
    full = client.get(url)
    assert full["Accept-Ranges"] == "bytes"
    assert full["Content-Type"] == "video/mp4"
    partial = client.get(url, HTTP_RANGE="bytes=0-9")
    assert partial.status_code == 206
    assert partial["Content-Range"] == f"bytes 0-9/{len(payload)}"
    assert partial.content == payload[:10]

    # Suffix range: the last 10 bytes.
    suffix = client.get(url, HTTP_RANGE="bytes=-10")
    assert suffix.status_code == 206
    assert suffix.content == payload[-10:]
    assert suffix["Content-Range"] == f"bytes {len(payload) - 10}-{len(payload) - 1}/{len(payload)}"

    # Unsatisfiable range (start past EOF) -> 416, not a bogus 206.
    bad = client.get(url, HTTP_RANGE=f"bytes={len(payload)}-{len(payload) + 5}")
    assert bad.status_code == 416
    assert bad["Content-Range"] == f"bytes */{len(payload)}"

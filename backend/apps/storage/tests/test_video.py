"""TDD spec for video playback + Stream promotion (PRD 5.5)."""
import json

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


def test_private_video_plays_from_r2(client, user):
    f = _video(user)
    resp = client.post(f"/api/v1/storage/files/{f.id}/play")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["mode"] == "r2"
    assert body["url"]
    assert body["max_resolution"] == "sd"  # free tier is SD-capped


def test_paid_tier_gets_hd_cap(client, user):
    user.tier = User.Tier.PAID_2TB
    user.save()
    f = _video(user)
    assert client.post(f"/api/v1/storage/files/{f.id}/play").json()["max_resolution"] == "hd"


def test_promote_to_stream_then_play_is_hls(client, user):
    f = _video(user)
    promote = client.post(f"/api/v1/storage/files/{f.id}/promote")
    assert promote.status_code == 200
    uid = promote.json()["stream_uid"]
    assert uid
    f.refresh_from_db()
    assert f.stream_uid == uid

    play = client.post(f"/api/v1/storage/files/{f.id}/play").json()
    assert play["mode"] == "hls"
    assert play["stream_uid"] == uid
    assert play["url"].endswith(".m3u8")


def test_promote_is_idempotent(client, user):
    f = _video(user)
    first = client.post(f"/api/v1/storage/files/{f.id}/promote").json()["stream_uid"]
    second = client.post(f"/api/v1/storage/files/{f.id}/promote").json()["stream_uid"]
    assert first == second


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


def test_stream_webhook_is_idempotent(db):
    anon = APIClient()
    payload = json.dumps({"uid": "vid_1", "status": "ready"}).encode()
    first = anon.post("/api/v1/storage/stream/webhook", data=payload, content_type="application/json")
    assert first.status_code == 200 and first.json()["processed"] is True
    second = anon.post("/api/v1/storage/stream/webhook", data=payload, content_type="application/json")
    assert second.json()["processed"] is False


# --- fallback when Cloudflare Stream is not configured -----------------------

from django.test import override_settings  # noqa: E402


@override_settings(CLOUDFLARE_STREAM_ENABLED=False)
def test_promote_unavailable_when_stream_not_configured(client, user):
    f = _video(user)
    resp = client.post(f"/api/v1/storage/files/{f.id}/promote")
    assert resp.status_code == 503
    assert resp.json()["code"] == "stream_unavailable"


@override_settings(CLOUDFLARE_STREAM_ENABLED=False)
def test_play_falls_back_to_direct_when_stream_disabled(client, user):
    f = _video(user)
    # even if a stale stream_uid exists, playback stays direct-from-storage
    f.stream_uid = "stale-uid"
    f.save(update_fields=["stream_uid"])
    body = client.post(f"/api/v1/storage/files/{f.id}/play").json()
    assert body["mode"] == "r2"
    assert body["url"]


def test_storage_service_default_falls_back_without_r2(monkeypatch):
    """The env-aware default selects the local media folder when R2 is unconfigured."""
    import importlib

    import config.settings.base as base
    for var in ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
                "CLOUDFLARE_STREAM_ACCOUNT_ID", "CLOUDFLARE_STREAM_API_TOKEN"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.delenv("STORAGE_SERVICE", raising=False)
    monkeypatch.delenv("VIDEO_SERVICE", raising=False)
    reloaded = importlib.reload(base)
    try:
        assert reloaded.R2_CONFIGURED is False
        assert reloaded.STORAGE_SERVICE.endswith("LocalStorageService")
        assert reloaded.CLOUDFLARE_STREAM_ENABLED is False
        assert reloaded.VIDEO_SERVICE.endswith("FakeVideoService")
    finally:
        importlib.reload(base)  # restore

"""DEACTIVATED — streaming-platform tests (promote-to-Stream, HLS, webhook, HD).

Preserved with the feature (see docs/deactivated-features.md). Not collected
(deactivated/ is excluded in pytest.ini). To re-run, restore the routes in
apps/storage/urls.py and the HD/HLS logic, then move these back.
"""
import json

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


def _video(user, name="clip.mp4"):
    obj = StorageObject.objects.create(content_hash="a" * 64, region=user.storage_region,
                                       size_bytes=1000, ref_count=1,
                                       status=StorageObject.Status.READY, object_key=f"{user.id}/clip")
    return File.objects.create(owner=user, name=name, size_bytes=1000, kind=File.Kind.VIDEO,
                               status=File.Status.READY, storage_object=obj)


def _client(user):
    c = APIClient(); c.force_authenticate(user); return c


def test_paid_tier_gets_hd_cap(db):
    user = User.objects.create_user(email="v@floppy.disk", password="hunter2pass")
    user.tier = User.Tier.PAID_2TB; user.save()
    f = _video(user)
    assert _client(user).post(f"/api/v1/storage/files/{f.id}/play").json()["max_resolution"] == "hd"


def test_promote_to_stream_then_play_is_hls(db):
    user = User.objects.create_user(email="v@floppy.disk", password="hunter2pass")
    c = _client(user); f = _video(user)
    uid = c.post(f"/api/v1/storage/files/{f.id}/promote").json()["stream_uid"]
    play = c.post(f"/api/v1/storage/files/{f.id}/play").json()
    assert play["mode"] == "hls" and play["stream_uid"] == uid


def test_stream_webhook_is_idempotent(db):
    anon = APIClient()
    payload = json.dumps({"uid": "vid_1", "status": "ready"}).encode()
    first = anon.post("/api/v1/storage/stream/webhook", data=payload, content_type="application/json")
    assert first.status_code == 200 and first.json()["processed"] is True


@override_settings(CLOUDFLARE_STREAM_ENABLED=False)
def test_promote_unavailable_when_stream_not_configured(db):
    user = User.objects.create_user(email="v@floppy.disk", password="hunter2pass")
    f = _video(user)
    resp = _client(user).post(f"/api/v1/storage/files/{f.id}/promote")
    assert resp.status_code == 503 and resp.json()["code"] == "stream_unavailable"

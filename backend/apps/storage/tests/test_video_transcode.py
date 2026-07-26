"""Self-hosted video transcoding (FFmpeg pipeline, no third-party streaming).

Uses the FakeTranscoder (no ffmpeg binary needed): `.mp4` uploads are treated
as already web-playable, anything else gets a (pretend) transcode so both paths
are covered. The Celery task runs eagerly in tests.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="t@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _upload(client, name, payload=b"video-bytes-1234", kind="video"):
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(payload), "kind": kind},
        format="json",
    ).json()
    client.put(init["upload"]["url"], data=payload, content_type="application/octet-stream")
    resp = client.post(f"/api/v1/storage/uploads/{init['file']['id']}/complete")
    return init["file"]["id"], resp


def test_non_web_playable_video_gets_a_transcoded_rendition(client, user, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    file_id, resp = _upload(client, "home-movie.mkv")
    assert resp.status_code == 200, resp.content

    f = File.objects.select_related("playable_object", "storage_object").get(pk=file_id)
    # Transcode ran (eager) -> ready, with a rendition distinct from the original.
    assert f.status == File.Status.READY
    assert f.playable_object_id is not None
    assert f.playable_object_id != f.storage_object_id
    # Probed metadata is recorded.
    assert f.duration_seconds == 10.0
    assert (f.width, f.height) == (1280, 720)
    assert f.poster_object_id is not None


def test_already_web_playable_mp4_is_served_directly(client, user, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    file_id, resp = _upload(client, "clip.mp4")
    assert resp.status_code == 200

    f = File.objects.get(pk=file_id)
    assert f.status == File.Status.READY
    # No separate rendition: the original is already browser-playable.
    assert f.playable_object_id == f.storage_object_id
    assert f.poster_object_id is not None


def test_play_returns_rendition_url_poster_and_duration(client, user, settings, tmp_path):
    settings.DEV_STORAGE_DIR = str(tmp_path)
    file_id, _ = _upload(client, "home-movie.avi")

    resp = client.post(f"/api/v1/storage/files/{file_id}/play")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["mode"] == "direct"
    assert body["url"]
    assert body["poster"]
    assert body["duration_seconds"] == 10.0
    # The play URL points at the transcoded rendition (object_key ends .play.mp4).
    f = File.objects.get(pk=file_id)
    assert f.playable_object.object_key.endswith(".play.mp4")
    assert f.playable_object.object_key in body["url"]


def test_play_409_while_processing(client, user, settings, tmp_path):
    """A video not yet transcoded reports processing (409), not a broken URL."""
    obj = StorageObject.objects.create(
        content_hash="c" * 64, region=user.storage_region, size_bytes=10,
        ref_count=1, status=StorageObject.Status.READY, object_key=f"{user.id}/x",
    )
    f = File.objects.create(
        owner=user, name="x.mkv", size_bytes=10, kind=File.Kind.VIDEO,
        status=File.Status.PROCESSING, storage_object=obj,
    )
    resp = client.post(f"/api/v1/storage/files/{f.id}/play")
    assert resp.status_code == 409
    assert resp.json()["code"] == "processing"


def test_transcode_falls_back_to_original_when_bytes_missing(user):
    """process_video is defensive: missing blob bytes -> serve the original, ready."""
    from apps.storage.video_processing import process_video

    obj = StorageObject.objects.create(
        content_hash="d" * 64, region=user.storage_region, size_bytes=10,
        ref_count=1, status=StorageObject.Status.READY, object_key=f"{user.id}/missing",
    )
    f = File.objects.create(
        owner=user, name="gone.mkv", size_bytes=10, kind=File.Kind.VIDEO,
        status=File.Status.PROCESSING, storage_object=obj,
    )
    process_video(str(f.id))
    f.refresh_from_db()
    assert f.status == File.Status.READY
    assert f.playable_object_id == f.storage_object_id

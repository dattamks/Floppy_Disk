"""Gallery media endpoint: all images + videos across folders, newest first."""
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File, Folder, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="media@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _file(user, name, kind, folder=None, status=File.Status.READY):
    h = uuid.uuid4().hex.ljust(64, "0")[:64]
    obj = StorageObject.objects.create(
        content_hash=h, region=user.storage_region,
        size_bytes=1, ref_count=1, status=StorageObject.Status.READY, object_key=f"{user.id}/{h}",
    )
    return File.objects.create(owner=user, name=name, size_bytes=1, kind=kind,
                               status=status, storage_object=obj, folder=folder)


def test_media_lists_images_and_videos_across_folders(client, user):
    sub = Folder.objects.create(owner=user, name="Trip")
    _file(user, "a.jpg", File.Kind.IMAGE)
    _file(user, "clip.mp4", File.Kind.VIDEO, folder=sub)   # in a subfolder
    _file(user, "song.mp3", File.Kind.AUDIO)                # included (audio category)
    _file(user, "notes.pdf", File.Kind.DOC)                 # excluded (not media)
    _file(user, "pending.jpg", File.Kind.IMAGE, status=File.Status.PENDING)  # excluded

    r = client.get("/api/v1/storage/media")
    assert r.status_code == 200
    names = [f["name"] for f in r.json()]
    assert set(names) == {"a.jpg", "clip.mp4", "song.mp3"}  # images + videos + audio, all folders


def test_media_is_owner_scoped(client, user):
    other = User.objects.create_user(email="other@floppy.disk", password="hunter2pass")
    _file(user, "mine.jpg", File.Kind.IMAGE)
    _file(other, "theirs.jpg", File.Kind.IMAGE)

    names = [f["name"] for f in client.get("/api/v1/storage/media").json()]
    assert names == ["mine.jpg"]


def test_media_excludes_trashed(client, user):
    f = _file(user, "gone.jpg", File.Kind.IMAGE)
    _file(user, "here.jpg", File.Kind.IMAGE)
    from django.utils import timezone
    File.objects.filter(pk=f.pk).update(deleted_at=timezone.now())

    names = [f["name"] for f in client.get("/api/v1/storage/media").json()]
    assert names == ["here.jpg"]

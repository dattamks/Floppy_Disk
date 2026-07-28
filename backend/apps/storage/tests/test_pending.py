"""PENDING-upload handling: not listed, not editable, and GC'd when abandoned."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.storage.lifecycle import purge_abandoned_uploads
from apps.storage.models import File

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="p@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _pending(user, size=1000):
    return File.objects.create(owner=user, name="draft.txt", size_bytes=size,
                               status=File.Status.PENDING)


def test_pending_file_not_in_listing(client, user):
    _pending(user)
    assert client.get("/api/v1/storage/files").json() == []


def test_cannot_edit_pending_file(client, user):
    f = _pending(user)
    resp = client.put(f"/api/v1/storage/files/{f.id}/content",
                      {"content": "hi"}, format="json")
    assert resp.status_code == 409
    # Quota was not touched (no negative drift).
    user.refresh_from_db()
    assert user.storage_used_bytes == 0


def test_abandoned_pending_uploads_are_purged(user):
    old = _pending(user)
    File.objects.filter(pk=old.id).update(created_at=timezone.now() - timedelta(hours=2))
    fresh = _pending(user)  # recent — an upload may still be in flight

    assert purge_abandoned_uploads() == 1
    assert not File.objects.filter(pk=old.id).exists()
    assert File.objects.filter(pk=fresh.id).exists()

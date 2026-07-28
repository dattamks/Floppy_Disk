"""TDD spec for discovery search: own files + others' discoverable, non-mature."""
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


def _client(u):
    c = APIClient(); c.force_authenticate(u); return c


def _file(owner, name, *, discoverable=False, mature=False, status=File.Status.READY,
          trashed=False):
    from django.utils import timezone
    obj = StorageObject.objects.create(content_hash=uuid.uuid4().hex + uuid.uuid4().hex,
                                       region=owner.storage_region, size_bytes=10, ref_count=1,
                                       status=StorageObject.Status.READY)
    return File.objects.create(
        owner=owner, name=name, size_bytes=10, status=status, storage_object=obj,
        is_discoverable=discoverable, is_mature_content=mature,
        deleted_at=timezone.now() if trashed else None,
    )


@pytest.fixture
def me(db):
    return User.objects.create_user(email="me@floppy.disk", password="hunter2pass")


@pytest.fixture
def other(db):
    return User.objects.create_user(email="other@floppy.disk", password="hunter2pass")


def _search(client, q):
    return [r["name"] for r in client.get(f"/api/v1/storage/search?q={q}").json()["results"]]


def test_finds_own_file_by_substring(me):
    _file(me, "quarterly-report.pdf")
    assert "quarterly-report.pdf" in _search(_client(me), "quarterly")


def test_finds_another_users_discoverable_file(me, other):
    _file(other, "public-dataset.csv", discoverable=True)
    assert "public-dataset.csv" in _search(_client(me), "dataset")


def test_does_not_find_another_users_private_file(me, other):
    _file(other, "secret-private.txt", discoverable=False)
    assert _search(_client(me), "secret") == []


def test_mature_discoverable_is_excluded_from_discovery(me, other):
    _file(other, "mature-clip.mp4", discoverable=True, mature=True)
    assert _search(_client(me), "mature") == []


def test_owner_still_finds_own_mature_file(me):
    _file(me, "my-mature-note.txt", discoverable=True, mature=True)
    assert "my-mature-note.txt" in _search(_client(me), "mature")


def test_trashed_is_excluded(me):
    _file(me, "trashed-doc.txt", trashed=True)
    assert _search(_client(me), "doc") == []


def test_empty_query_returns_nothing(me):
    _file(me, "something.txt")
    assert _client(me).get("/api/v1/storage/search?q=").json()["results"] == []


def test_toggle_discoverable(me, other):
    f = _file(me, "toggle-me.txt")
    # not discoverable to others yet
    assert _search(_client(other), "toggle") == []
    _client(me).post(f"/api/v1/storage/files/{f.id}/discoverable", {"is_discoverable": True}, format="json")
    assert "toggle-me.txt" in _search(_client(other), "toggle")

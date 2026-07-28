"""TDD spec for DPDPA account deletion + data export."""
from datetime import datetime, timedelta, timezone

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.compliance import hard_delete_expired_accounts
from apps.accounts.models import ConsentLog, DataExport
from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db
NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _file(user):
    import uuid
    obj = StorageObject.objects.create(content_hash=uuid.uuid4().hex + uuid.uuid4().hex,
                                       region=user.storage_region, size_bytes=100, ref_count=1,
                                       status=StorageObject.Status.READY, object_key=f"{user.id}/k")
    return File.objects.create(owner=user, name="doc.txt", size_bytes=100,
                               status=File.Status.READY, storage_object=obj)


# --- deletion ---------------------------------------------------------------

def test_delete_soft_deletes_immediately():
    user = User.objects.create_user(email="del@floppy.disk", password="hunter2pass")
    resp = _client(user).post("/api/v1/auth/account/delete")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.status == User.Status.DELETED
    assert user.deleted_at is not None
    assert user.is_active is False


def test_hard_delete_job_purges_after_30_days():
    user = User.objects.create_user(email="old@floppy.disk", password="hunter2pass")
    _file(user)
    user.mark_deleted()
    User.objects.filter(pk=user.pk).update(deleted_at=NOW - timedelta(days=31))

    assert hard_delete_expired_accounts(now=NOW) == 1
    assert not User.objects.filter(pk=user.pk).exists()


def test_hard_delete_skips_recent_deletions():
    user = User.objects.create_user(email="recent@floppy.disk", password="hunter2pass")
    user.mark_deleted()
    User.objects.filter(pk=user.pk).update(deleted_at=NOW - timedelta(days=10))
    assert hard_delete_expired_accounts(now=NOW) == 0
    assert User.objects.filter(pk=user.pk).exists()


# --- export -----------------------------------------------------------------

def test_export_produces_a_downloadable_archive():
    user = User.objects.create_user(email="exp@floppy.disk", password="hunter2pass")
    _file(user)
    resp = _client(user).post("/api/v1/auth/account/export")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["download_url"]
    assert body["size_bytes"] > 0
    assert DataExport.objects.filter(user=user).count() == 1


# --- consent ----------------------------------------------------------------

def test_consent_is_logged():
    user = User.objects.create_user(email="c@floppy.disk", password="hunter2pass")
    resp = _client(user).post("/api/v1/auth/account/consent",
                              {"policy": "tos", "version": "2026-01"}, format="json")
    assert resp.status_code == 204
    assert ConsentLog.objects.filter(user=user, version="2026-01").exists()

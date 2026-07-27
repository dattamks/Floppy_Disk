"""TDD spec for device backup: settings, Camera Backup folder, quota-pause notify."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.storage.models import Folder

User = get_user_model()
pytestmark = pytest.mark.django_db
GB = 1024**3


def _client(u):
    c = APIClient(); c.force_authenticate(u); return c


@pytest.fixture
def user(db):
    return User.objects.create_user(email="bk@floppy.disk", password="hunter2pass")


def test_backup_settings_default_and_update(user):
    c = _client(user)
    got = c.get("/api/v1/auth/account/settings").json()
    assert got["auto_backup_enabled"] is False
    assert got["backup_wifi_only"] is True
    resp = c.patch("/api/v1/auth/account/settings",
                   {"auto_backup_enabled": True, "backup_wifi_only": False}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.auto_backup_enabled is True
    assert user.backup_wifi_only is False


def test_profile_and_2fa_settings_persist(user):
    c = _client(user)
    resp = c.patch("/api/v1/auth/account/settings",
                   {"display_name": "  Aiden Rivera  ", "two_factor_enabled": True}, format="json")
    assert resp.status_code == 200
    body = resp.json()
    assert body["display_name"] == "Aiden Rivera"  # trimmed
    assert body["two_factor_enabled"] is True
    user.refresh_from_db()
    assert user.display_name == "Aiden Rivera"
    assert user.two_factor_enabled is True
    # And /me reflects the persisted 2FA flag.
    assert c.get("/api/v1/auth/me").json()["two_factor_enabled"] is True


def test_camera_backup_folder_is_created_once(user):
    c = _client(user)
    first = c.get("/api/v1/storage/camera-backup").json()
    assert first["name"] == "Camera Backup"
    second = c.get("/api/v1/storage/camera-backup").json()
    assert first["id"] == second["id"]  # idempotent
    assert Folder.objects.filter(owner=user, name="Camera Backup").count() == 1


def test_backup_upload_over_quota_pauses_and_notifies(user):
    user.quota_bytes = 1 * GB
    user.storage_used_bytes = 1 * GB
    user.tier = User.Tier.PAID_2TB  # so the per-file cap isn't what trips it
    user.save()
    c = _client(user)
    folder = c.get("/api/v1/storage/camera-backup").json()

    resp = c.post("/api/v1/storage/uploads",
                  {"name": "IMG_1234.jpg", "size_bytes": 5 * GB, "kind": "image",
                   "folder": folder["id"], "is_backup": True}, format="json")
    assert resp.status_code == 400
    assert resp.json()["code"] == "quota_exceeded"
    # paused, not silent: a quota notification was raised
    assert Notification.objects.filter(user=user, type="quota").exists()

"""The migrate_storage_to_r2 command: local disk -> R2, idempotent & resumable."""
import hashlib

import pytest
from botocore.exceptions import ClientError
from django.core.management import CommandError, call_command
from django.test import override_settings

from apps.storage.models import StorageObject
from apps.storage.services.local import LocalStorageService

pytestmark = pytest.mark.django_db


class FakeS3:
    """In-memory S3 supporting the calls the migration touches."""

    def __init__(self):
        self.objects = {}  # (bucket, key) -> bytes

    def head_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        return {"ContentLength": len(self.objects[(Bucket, Key)])}

    def upload_file(self, Filename, Bucket, Key):
        with open(Filename, "rb") as fh:
            self.objects[(Bucket, Key)] = fh.read()


R2_ENV = dict(
    STORAGE_SERVICE="apps.storage.services.r2.R2StorageService",
    R2_ENDPOINT_URL="https://acct.r2.cloudflarestorage.com",
    R2_ACCESS_KEY_ID="ak", R2_SECRET_ACCESS_KEY="sk", R2_BUCKET="floppy",
    R2_REGION_BUCKETS={},
)


@pytest.fixture
def fake_r2(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr("apps.storage.services.r2.boto3.client", lambda *a, **k: fake)
    return fake


def _blob(local, *, region, key, data):
    """Create a StorageObject and write its bytes to the local backend."""
    obj = StorageObject.objects.create(
        content_hash=hashlib.sha256(data).hexdigest(), region=region,
        size_bytes=len(data), ref_count=1, object_key=key,
    )
    local.save_bytes(region=region, object_key=key, data=data)
    return obj


@override_settings(**R2_ENV)
def test_migrates_local_blobs_and_is_idempotent(tmp_path, fake_r2, monkeypatch):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        local = LocalStorageService()
        _blob(local, region="ap-south", key="u1/a", data=b"alpha")
        _blob(local, region="ap-south", key="u1/b", data=b"bravo")

        call_command("migrate_storage_to_r2")
        assert fake_r2.objects[("floppy", "u1/a")] == b"alpha"
        assert fake_r2.objects[("floppy", "u1/b")] == b"bravo"

        # Re-running skips everything already present (resumable, no dupes).
        before = dict(fake_r2.objects)
        call_command("migrate_storage_to_r2")
        assert fake_r2.objects == before


@override_settings(**R2_ENV)
def test_dry_run_uploads_nothing(tmp_path, fake_r2):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        local = LocalStorageService()
        _blob(local, region="ap-south", key="u1/a", data=b"alpha")
        call_command("migrate_storage_to_r2", "--dry-run")
        assert fake_r2.objects == {}


@override_settings(**R2_ENV)
def test_missing_local_file_is_skipped_not_fatal(tmp_path, fake_r2):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        # StorageObject exists but no bytes on disk (already remote / lost).
        StorageObject.objects.create(
            content_hash="d" * 64, region="ap-south", size_bytes=3,
            ref_count=1, object_key="u1/ghost",
        )
        call_command("migrate_storage_to_r2")  # must not raise
        assert ("floppy", "u1/ghost") not in fake_r2.objects


@override_settings(**R2_ENV)
def test_delete_local_removes_verified_copies(tmp_path, fake_r2):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        local = LocalStorageService()
        _blob(local, region="ap-south", key="u1/a", data=b"alpha")
        path = local.local_path(region="ap-south", object_key="u1/a")
        assert path.exists()
        call_command("migrate_storage_to_r2", "--delete-local")
        assert fake_r2.objects[("floppy", "u1/a")] == b"alpha"
        assert not path.exists()  # local copy reclaimed after verification


@override_settings(STORAGE_SERVICE="apps.storage.services.local.LocalStorageService")
def test_refuses_when_backend_is_not_r2():
    with pytest.raises(CommandError):
        call_command("migrate_storage_to_r2")


@override_settings(**R2_ENV)
def test_skips_zero_ref_orphans(tmp_path, fake_r2):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        local = LocalStorageService()
        # An orphaned blob (ref_count 0) awaiting purge shouldn't be migrated.
        StorageObject.objects.create(
            content_hash="e" * 64, region="ap-south", size_bytes=5,
            ref_count=0, object_key="u1/orphan",
        )
        local.save_bytes(region="ap-south", object_key="u1/orphan", data=b"orph!")
        call_command("migrate_storage_to_r2")
        assert ("floppy", "u1/orphan") not in fake_r2.objects

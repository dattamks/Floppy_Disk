"""The background migration engine (run_migration_job) that drives the UI job."""
import hashlib

import pytest
from botocore.exceptions import ClientError
from django.test import override_settings

from apps.storage.config import encrypt_secret
from apps.storage.migration import run_migration_job
from apps.storage.models import StorageConfig, StorageMigration, StorageObject
from apps.storage.services.local import LocalStorageService

pytestmark = pytest.mark.django_db


class FakeS3:
    def __init__(self):
        self.objects = {}

    def head_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        return {"ContentLength": len(self.objects[(Bucket, Key)])}

    def upload_file(self, Filename, Bucket, Key):
        with open(Filename, "rb") as fh:
            self.objects[(Bucket, Key)] = fh.read()


@pytest.fixture
def fake_r2(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr("apps.storage.services.r2.boto3.client", lambda *a, **k: fake)
    return fake


def _configure_db_r2():
    cfg = StorageConfig.load()
    cfg.backend = StorageConfig.Backend.R2
    cfg.r2_endpoint_url = "https://e"
    cfg.r2_access_key_id = "ak"
    cfg.r2_secret_ciphertext = encrypt_secret("sk")
    cfg.r2_bucket = "floppy"
    cfg.save()


def _blob(local, *, key, data, region="ap-south", ref_count=1):
    StorageObject.objects.create(
        content_hash=hashlib.sha256(data + key.encode()).hexdigest(), region=region,
        size_bytes=len(data), ref_count=ref_count, object_key=key,
    )
    local.save_bytes(region=region, object_key=key, data=data)


def test_engine_moves_blobs_and_marks_done(tmp_path, fake_r2):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        _configure_db_r2()
        local = LocalStorageService()
        _blob(local, key="u/a", data=b"alpha")
        _blob(local, key="u/b", data=b"bravo")
        job = StorageMigration.objects.create()

        run_migration_job(job.id)

        job.refresh_from_db()
        assert job.status == StorageMigration.Status.DONE
        assert job.total == 2 and job.done == 2 and job.failed == 0
        assert job.bytes_moved == len(b"alpha") + len(b"bravo")
        assert job.finished_at is not None
        assert fake_r2.objects[("floppy", "u/a")] == b"alpha"


def test_engine_skips_already_present(tmp_path, fake_r2):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        _configure_db_r2()
        local = LocalStorageService()
        _blob(local, key="u/a", data=b"alpha")
        fake_r2.objects[("floppy", "u/a")] = b"alpha"  # already uploaded
        job = StorageMigration.objects.create()

        run_migration_job(job.id)

        job.refresh_from_db()
        assert job.skipped == 1 and job.done == 0
        assert job.status == StorageMigration.Status.DONE


def test_engine_deletes_local_when_requested(tmp_path, fake_r2):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        _configure_db_r2()
        local = LocalStorageService()
        _blob(local, key="u/a", data=b"alpha")
        path = local.local_path(region="ap-south", object_key="u/a")
        job = StorageMigration.objects.create(delete_local=True)

        run_migration_job(job.id)

        assert fake_r2.objects[("floppy", "u/a")] == b"alpha"
        assert not path.exists()  # reclaimed after verified upload


def test_engine_pauses_when_cancel_requested(tmp_path, fake_r2):
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        _configure_db_r2()
        local = LocalStorageService()
        _blob(local, key="u/a", data=b"alpha")
        # cancel is checked at the very first blob (processed % 3 == 0).
        job = StorageMigration.objects.create(cancel_requested=True)

        run_migration_job(job.id)

        job.refresh_from_db()
        assert job.status == StorageMigration.Status.PAUSED
        assert ("floppy", "u/a") not in fake_r2.objects


def test_engine_fails_cleanly_when_backend_not_r2(tmp_path):
    # No R2 configured -> active backend is local -> job fails with a message.
    with override_settings(DEV_STORAGE_DIR=str(tmp_path)):
        job = StorageMigration.objects.create()
        run_migration_job(job.id)
        job.refresh_from_db()
        assert job.status == StorageMigration.Status.FAILED
        assert "not R2" in job.error

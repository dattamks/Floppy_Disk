"""Owner-only storage admin API: config, test-connection, migration."""

import pytest
from botocore.exceptions import ClientError
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.config import decrypt_secret
from apps.storage.models import StorageConfig, StorageMigration

User = get_user_model()
pytestmark = pytest.mark.django_db

BASE = "/api/v1/admin/storage/"


@pytest.fixture
def owner():
    return User.objects.create_user(email="owner@floppy.disk", password="x", is_owner=True)


@pytest.fixture
def member():
    return User.objects.create_user(email="member@floppy.disk", password="x")


@pytest.fixture
def oc(owner):
    c = APIClient()
    c.force_authenticate(owner)
    return c


# --- access control -------------------------------------------------------
def test_non_owner_is_forbidden(member):
    c = APIClient()
    c.force_authenticate(member)
    assert c.get(BASE).status_code == 403
    assert c.put(BASE, {"backend": "local"}, format="json").status_code == 403
    assert c.post(BASE + "migrate", {}, format="json").status_code == 403


def test_anonymous_is_unauthorized():
    assert APIClient().get(BASE).status_code in (401, 403)


def test_owner_can_read_config(oc):
    r = oc.get(BASE)
    assert r.status_code == 200
    body = r.json()
    assert body["backend"] == "local"
    assert body["effective_backend"] == "local"
    assert body["r2"]["secret_set"] is False
    assert "local_blobs" in body


# --- saving config --------------------------------------------------------
def test_save_r2_encrypts_secret_and_never_returns_it(oc):
    r = oc.put(BASE, {
        "backend": "r2",
        "endpoint_url": "https://acct.r2.cloudflarestorage.com",
        "access_key_id": "ak",
        "secret_access_key": "sk-super-secret",
        "bucket": "floppy",
    }, format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["backend"] == "r2"
    assert body["effective_backend"] == "r2"
    assert body["r2"]["secret_set"] is True
    # The secret is never echoed back anywhere in the response.
    assert "sk-super-secret" not in r.content.decode()
    # Stored encrypted, decryptable to the original.
    cfg = StorageConfig.load()
    assert cfg.r2_secret_ciphertext and cfg.r2_secret_ciphertext != "sk-super-secret"
    assert decrypt_secret(cfg.r2_secret_ciphertext) == "sk-super-secret"


def test_save_r2_missing_fields_is_400(oc):
    r = oc.put(BASE, {"backend": "r2", "bucket": "floppy"}, format="json")
    assert r.status_code == 400
    assert r.json()["code"] == "incomplete"


def test_edit_keeps_existing_secret_when_omitted(oc):
    oc.put(BASE, {"backend": "r2", "endpoint_url": "https://e", "access_key_id": "ak",
                  "secret_access_key": "sk1", "bucket": "b1"}, format="json")
    # Change only the bucket; no secret supplied.
    r = oc.put(BASE, {"backend": "r2", "endpoint_url": "https://e", "access_key_id": "ak",
                      "bucket": "b2"}, format="json")
    assert r.status_code == 200, r.content
    cfg = StorageConfig.load()
    assert cfg.r2_bucket == "b2"
    assert decrypt_secret(cfg.r2_secret_ciphertext) == "sk1"  # preserved


def test_env_managed_config_is_read_only(oc):
    from django.test import override_settings
    with override_settings(R2_CONFIGURED=True):
        r = oc.put(BASE, {"backend": "local"}, format="json")
        assert r.status_code == 409
        assert r.json()["code"] == "env_managed"


# --- test connection ------------------------------------------------------
class _FakeS3:
    def __init__(self, fail=False):
        self.fail = fail

    def list_objects_v2(self, **kw):
        if self.fail:
            raise ClientError({"Error": {"Code": "AccessDenied"}}, "ListObjectsV2")
        return {"KeyCount": 0}


def test_test_connection_ok(oc, monkeypatch):
    monkeypatch.setattr("apps.storage.services.r2.boto3.client", lambda *a, **k: _FakeS3())
    r = oc.post(BASE + "test", {"endpoint_url": "https://e", "access_key_id": "ak",
                                "secret_access_key": "sk", "bucket": "b"}, format="json")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_test_connection_failure_is_friendly(oc, monkeypatch):
    monkeypatch.setattr("apps.storage.services.r2.boto3.client", lambda *a, **k: _FakeS3(fail=True))
    r = oc.post(BASE + "test", {"endpoint_url": "https://e", "access_key_id": "ak",
                                "secret_access_key": "bad", "bucket": "b"}, format="json")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert "access key" in body["error"].lower()


# --- migration ------------------------------------------------------------
def test_migrate_refused_until_r2_configured(oc):
    r = oc.post(BASE + "migrate", {}, format="json")
    assert r.status_code == 400
    assert r.json()["code"] == "not_r2"


def test_migrate_starts_job_and_reports_status(oc, owner, monkeypatch):
    # Configure R2 in the DB and stub the background thread so the test is
    # deterministic (we assert a job row is created + returned).
    oc.put(BASE, {"backend": "r2", "endpoint_url": "https://e", "access_key_id": "ak",
                  "secret_access_key": "sk", "bucket": "b"}, format="json")
    started = {}
    monkeypatch.setattr("apps.storage.admin_views.start_migration_job",
                        lambda job: started.setdefault("id", job.pk))
    r = oc.post(BASE + "migrate", {"delete_local": True}, format="json")
    assert r.status_code == 202, r.content
    body = r.json()
    assert body["status"] == "pending" and body["delete_local"] is True
    assert started["id"]  # background runner was invoked
    # Status endpoint returns the same job.
    s = oc.get(BASE + "migrate")
    assert s.json()["id"] == body["id"]


def test_migrate_is_singleton_while_active(oc, monkeypatch):
    oc.put(BASE, {"backend": "r2", "endpoint_url": "https://e", "access_key_id": "ak",
                  "secret_access_key": "sk", "bucket": "b"}, format="json")
    monkeypatch.setattr("apps.storage.admin_views.start_migration_job", lambda job: None)
    a = oc.post(BASE + "migrate", {}, format="json").json()
    b = oc.post(BASE + "migrate", {}, format="json").json()
    assert a["id"] == b["id"]  # no second concurrent job
    assert StorageMigration.objects.count() == 1


def test_pause_sets_cancel_flag(oc, monkeypatch):
    oc.put(BASE, {"backend": "r2", "endpoint_url": "https://e", "access_key_id": "ak",
                  "secret_access_key": "sk", "bucket": "b"}, format="json")
    monkeypatch.setattr("apps.storage.admin_views.start_migration_job", lambda job: None)
    oc.post(BASE + "migrate", {}, format="json")
    r = oc.post(BASE + "migrate/pause", {}, format="json")
    assert r.status_code == 200
    job = StorageMigration.objects.first()
    assert job.cancel_requested is True

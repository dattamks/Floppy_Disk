"""Owner-set StorageConfig: encryption, backend resolution, and precedence."""
import pytest
from django.test import override_settings

from apps.storage.config import (
    decrypt_secret,
    effective_backend,
    encrypt_secret,
    env_manages_storage,
)
from apps.storage.models import StorageConfig
from apps.storage.services.base import get_storage_service
from apps.storage.services.local import LocalStorageService
from apps.storage.services.r2 import R2StorageService

pytestmark = pytest.mark.django_db


def test_secret_encrypts_and_roundtrips():
    token = encrypt_secret("super-secret-key")
    assert token and token != "super-secret-key"      # actually encrypted
    assert "super-secret-key" not in token
    assert decrypt_secret(token) == "super-secret-key"


def test_empty_secret_stays_empty():
    assert encrypt_secret("") == ""
    assert decrypt_secret("") == ""


def test_config_is_singleton():
    a = StorageConfig.load()
    a.r2_bucket = "b1"
    a.save()
    b = StorageConfig.load()
    assert a.pk == b.pk == 1
    assert StorageConfig.objects.count() == 1
    assert b.r2_bucket == "b1"


def _configure_r2_in_db():
    cfg = StorageConfig.load()
    cfg.backend = StorageConfig.Backend.R2
    cfg.r2_endpoint_url = "https://acct.r2.cloudflarestorage.com"
    cfg.r2_access_key_id = "ak"
    cfg.r2_secret_ciphertext = encrypt_secret("sk")
    cfg.r2_bucket = "floppy"
    cfg.save()
    return cfg


def test_effective_backend_defaults_local():
    assert effective_backend() == "local"
    assert isinstance(get_storage_service(), LocalStorageService)


def test_incomplete_r2_config_stays_local():
    cfg = StorageConfig.load()
    cfg.backend = StorageConfig.Backend.R2
    cfg.r2_bucket = "floppy"  # but no endpoint/keys
    cfg.save()
    assert effective_backend() == "local"
    assert isinstance(get_storage_service(), LocalStorageService)


def test_db_r2_config_selects_r2_with_injected_creds():
    _configure_r2_in_db()
    assert effective_backend() == "r2"
    svc = get_storage_service()
    assert isinstance(svc, R2StorageService)
    # Creds come from the DB row, not the (empty) environment.
    assert svc._bucket_for("ap-south") == "floppy"
    assert svc._endpoint_url == "https://acct.r2.cloudflarestorage.com"
    assert svc._secret_access_key == "sk"  # decrypted for use


@override_settings(R2_CONFIGURED=True,
                   STORAGE_SERVICE="apps.storage.services.r2.R2StorageService")
def test_environment_wins_over_db(monkeypatch):
    # Even with the DB set to local, env-configured R2 takes precedence and the
    # UI treats storage as env-managed.
    monkeypatch.delenv("STORAGE_SERVICE", raising=False)
    StorageConfig.load()  # backend defaults to local
    assert env_manages_storage() is True
    assert isinstance(get_storage_service(), R2StorageService)


def test_local_storage_warning_clears_when_db_r2_configured():
    from apps.storage.checks import local_storage_persistence_check

    _configure_r2_in_db()
    with override_settings(DEBUG=False):
        assert local_storage_persistence_check(None) == []

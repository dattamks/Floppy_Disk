"""The local-storage persistence warning (storage.W001)."""
from django.test import override_settings

from apps.storage.checks import W_LOCAL_STORAGE, local_storage_persistence_check

LOCAL = "apps.storage.services.local.LocalStorageService"
R2 = "apps.storage.services.r2.R2StorageService"


@override_settings(DEBUG=False, STORAGE_SERVICE=LOCAL, DEV_STORAGE_DIR="/data/storage")
def test_warns_on_local_storage_in_a_real_deployment():
    warnings = local_storage_persistence_check(None)
    assert len(warnings) == 1
    w = warnings[0]
    assert w.id == W_LOCAL_STORAGE
    # The message must actually be actionable: mention volume persistence + R2.
    assert "persistent volume" in w.msg
    assert "R2" in w.msg
    assert "/data/storage" in w.msg


@override_settings(DEBUG=False, STORAGE_SERVICE=R2)
def test_silent_when_r2_is_configured():
    assert local_storage_persistence_check(None) == []


@override_settings(DEBUG=True, STORAGE_SERVICE=LOCAL)
def test_silent_in_local_dev():
    # Dev / the test suite run on local storage by design — no nagging.
    assert local_storage_persistence_check(None) == []

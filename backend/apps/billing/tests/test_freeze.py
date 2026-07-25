"""TDD spec for the expiry-anchored freeze lifecycle (PRD 5.3)."""
from datetime import datetime, timedelta, timezone

import pytest
from django.contrib.auth import get_user_model

from apps.billing.freeze import (
    DELETE_GRACE_DAYS,
    FREEZE_GRACE_DAYS,
    process_lapsed_account,
    unfreeze_all,
)
from apps.billing.models import Subscription
from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
FREE_LIMIT = 300  # tiny limit so small test files exercise the logic


@pytest.fixture
def user(db):
    u = User.objects.create_user(email="f@floppy.disk", password="hunter2pass")
    u.tier = User.Tier.PAID_2TB
    u.save()
    return u


def _lapsed_sub(user, *, period_end, status=Subscription.Status.CANCELLED):
    return Subscription.objects.create(
        user=user, plan_code="paid_2tb", status=status, current_period_end=period_end,
    )


def _file(user, *, size, created, name="f", hash_=None, frozen=False):
    import uuid
    obj = StorageObject.objects.create(
        content_hash=hash_ or (uuid.uuid4().hex + uuid.uuid4().hex),
        region=user.storage_region, size_bytes=size, ref_count=1,
        status=StorageObject.Status.READY,
    )
    f = File.objects.create(owner=user, name=name, size_bytes=size, kind=File.Kind.DOC,
                            status=File.Status.READY, storage_object=obj, is_frozen=frozen)
    File.objects.filter(pk=f.pk).update(created_at=created)  # control ordering
    f.refresh_from_db()
    return f


def test_no_freeze_before_grace_window(user):
    _lapsed_sub(user, period_end=T0)
    _file(user, size=500, created=T0, name="big")
    # 10 days after expiry — still within the freeze grace window
    r = process_lapsed_account(user, now=T0 + timedelta(days=10), free_limit_bytes=FREE_LIMIT)
    assert r["frozen"] == 0
    assert File.objects.filter(owner=user, is_frozen=True).count() == 0


def test_freezes_newest_first_keeping_oldest(user):
    _lapsed_sub(user, period_end=T0)
    old = _file(user, size=200, created=T0, name="oldest")
    mid = _file(user, size=200, created=T0 + timedelta(days=1), name="middle")
    new = _file(user, size=200, created=T0 + timedelta(days=2), name="newest")
    # total 600 > 300 free limit -> freeze newest until <= 300 (freeze new + mid, keep old)
    r = process_lapsed_account(user, now=T0 + timedelta(days=FREEZE_GRACE_DAYS + 1), free_limit_bytes=FREE_LIMIT)
    assert r["frozen"] == 2
    old.refresh_from_db(); mid.refresh_from_db(); new.refresh_from_db()
    assert old.is_frozen is False       # oldest kept
    assert mid.is_frozen is True
    assert new.is_frozen is True


def test_under_limit_never_freezes(user):
    _lapsed_sub(user, period_end=T0)
    _file(user, size=100, created=T0)
    r = process_lapsed_account(user, now=T0 + timedelta(days=FREEZE_GRACE_DAYS + 1), free_limit_bytes=FREE_LIMIT)
    assert r["frozen"] == 0


def test_active_subscription_is_untouched(user):
    Subscription.objects.create(user=user, plan_code="paid_2tb",
                                status=Subscription.Status.ACTIVE, current_period_end=T0)
    _file(user, size=500, created=T0)
    r = process_lapsed_account(user, now=T0 + timedelta(days=100), free_limit_bytes=FREE_LIMIT)
    assert r == {"frozen": 0, "deleted": 0}


def test_frozen_files_are_hidden_from_listing(user):
    from rest_framework.test import APIClient
    _lapsed_sub(user, period_end=T0)
    _file(user, size=200, created=T0, name="oldest")
    _file(user, size=200, created=T0 + timedelta(days=2), name="newest")
    process_lapsed_account(user, now=T0 + timedelta(days=FREEZE_GRACE_DAYS + 1), free_limit_bytes=FREE_LIMIT)

    c = APIClient(); c.force_authenticate(user)
    names = [f["name"] for f in c.get("/api/v1/storage/files").json()]
    assert "newest" not in names   # frozen -> hidden
    assert "oldest" in names


def test_past_delete_window_purges_frozen(user):
    _lapsed_sub(user, period_end=T0)
    keep = _file(user, size=200, created=T0, name="oldest")
    doomed = _file(user, size=200, created=T0 + timedelta(days=2), name="newest")
    # far past the delete window: newest gets frozen then purged
    r = process_lapsed_account(user, now=T0 + timedelta(days=DELETE_GRACE_DAYS + 1), free_limit_bytes=FREE_LIMIT)
    assert r["deleted"] >= 1
    assert not File.objects.filter(pk=doomed.pk).exists()
    assert File.objects.filter(pk=keep.pk).exists()


def test_resubscribe_unfreezes(user):
    f = _file(user, size=200, created=T0, name="frozen", frozen=True)
    assert unfreeze_all(user) == 1
    f.refresh_from_db()
    assert f.is_frozen is False

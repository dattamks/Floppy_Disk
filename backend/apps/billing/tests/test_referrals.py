"""TDD spec for referrals: grant, cap, expiry, effective quota."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import ReferralBonus
from apps.billing.referrals import CAP_BYTES, GRANT_BYTES, effective_quota
from apps.storage.quota import available_bytes

User = get_user_model()
pytestmark = pytest.mark.django_db


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


@pytest.fixture
def referrer(db):
    return User.objects.create_user(email="ref@floppy.disk", password="hunter2pass")


@pytest.fixture
def referee(db):
    return User.objects.create_user(email="new@floppy.disk", password="hunter2pass")


def test_users_get_a_referral_code(referrer):
    assert referrer.referral_code
    assert len(referrer.referral_code) == 8


def test_apply_grants_referrer_a_bonus_and_raises_effective_quota(referrer, referee):
    base = effective_quota(referrer)
    resp = _client(referee).post("/api/v1/billing/referral/apply",
                                 {"code": referrer.referral_code}, format="json")
    assert resp.status_code == 201, resp.content
    assert resp.json()["granted_bytes"] == GRANT_BYTES

    referrer.refresh_from_db()
    assert effective_quota(referrer) == base + GRANT_BYTES
    assert available_bytes(referrer) == base + GRANT_BYTES  # nothing used yet
    referee.refresh_from_db()
    assert referee.referred_by_id == referrer.id


def test_cannot_refer_yourself(referrer):
    resp = _client(referrer).post("/api/v1/billing/referral/apply",
                                  {"code": referrer.referral_code}, format="json")
    assert resp.status_code == 400


def test_cannot_apply_a_code_twice(referrer, referee):
    c = _client(referee)
    c.post("/api/v1/billing/referral/apply", {"code": referrer.referral_code}, format="json")
    other = User.objects.create_user(email="third@floppy.disk", password="hunter2pass")
    resp = c.post("/api/v1/billing/referral/apply", {"code": other.referral_code}, format="json")
    assert resp.status_code == 400


def test_invalid_code_is_rejected(referee):
    resp = _client(referee).post("/api/v1/billing/referral/apply",
                                 {"code": "ZZZZZZZZ"}, format="json")
    assert resp.status_code == 400


def test_bonus_is_capped_at_1tb(referrer):
    # Pre-fill bonuses right up to the cap.
    n = CAP_BYTES // GRANT_BYTES
    for _ in range(n):
        ReferralBonus.objects.create(user=referrer, bytes=GRANT_BYTES,
                                     expires_at=timezone.now() + timedelta(days=180))
    newbie = User.objects.create_user(email="capped@floppy.disk", password="hunter2pass")
    resp = _client(newbie).post("/api/v1/billing/referral/apply",
                                {"code": referrer.referral_code}, format="json")
    assert resp.status_code == 400  # at cap


def test_expired_bonuses_do_not_count(referrer):
    ReferralBonus.objects.create(user=referrer, bytes=GRANT_BYTES,
                                 expires_at=timezone.now() - timedelta(days=1))
    assert effective_quota(referrer) == referrer.quota_bytes  # expired -> excluded


def test_referral_endpoint_reports_code_and_stats(referrer, referee):
    _client(referee).post("/api/v1/billing/referral/apply",
                          {"code": referrer.referral_code}, format="json")
    data = _client(referrer).get("/api/v1/billing/referral").json()
    assert data["code"] == referrer.referral_code
    assert data["referrals_count"] == 1
    assert data["bonus_bytes_active"] == GRANT_BYTES

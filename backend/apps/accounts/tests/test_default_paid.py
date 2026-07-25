"""Signup entitlements depend on whether billing (Razorpay) is enabled."""
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db
TB = 1024**4


def _dob(years):
    t = datetime.date.today()
    return t.replace(year=t.year - years).isoformat()


def _register(email):
    return APIClient().post("/api/v1/auth/register",
                            {"email": email, "password": "s3cretpass", "date_of_birth": _dob(30)},
                            format="json")


@override_settings(RAZORPAY_ENABLED=False, DEFAULT_SIGNUP_PLAN="paid_2tb")
def test_billing_disabled_defaults_new_user_to_paid():
    resp = _register("paidbydefault@floppy.disk")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["tier"] == "paid_2tb"
    assert body["quota_bytes"] == 2 * TB
    assert body["billing_enabled"] is False
    assert User.objects.get(email="paidbydefault@floppy.disk").tier == "paid_2tb"


@override_settings(RAZORPAY_ENABLED=True)
def test_billing_enabled_keeps_new_user_free():
    resp = _register("freeuser@floppy.disk")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["tier"] == "free"
    assert body["billing_enabled"] is True

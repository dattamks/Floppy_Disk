"""TDD spec for billing: subscribe (tier+quota), cancel, webhook idempotency."""
import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.billing.models import Subscription, WebhookEvent

User = get_user_model()
pytestmark = pytest.mark.django_db
TB = 1024**4


@pytest.fixture
def user(db):
    return User.objects.create_user(email="b@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_list_plans(client):
    resp = client.get("/api/v1/billing/plans")
    assert resp.status_code == 200
    codes = {p["code"] for p in resp.json()}
    assert {"free", "paid_2tb", "paid_5tb"} <= codes


def test_subscribe_upgrades_tier_and_quota(client, user):
    resp = client.post("/api/v1/billing/subscribe", {"plan": "paid_2tb"}, format="json")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["tier"] == "paid_2tb"
    assert body["quota_bytes"] == 2 * TB

    user.refresh_from_db()
    assert user.tier == "paid_2tb"
    assert user.quota_bytes == 2 * TB
    # reflected in the storage usage endpoint
    assert client.get("/api/v1/storage/usage").json()["quota_bytes"] == 2 * TB
    assert Subscription.objects.filter(user=user, status="active").count() == 1


def test_cannot_subscribe_to_free_or_unknown(client):
    assert client.post("/api/v1/billing/subscribe", {"plan": "free"}, format="json").status_code == 400
    assert client.post("/api/v1/billing/subscribe", {"plan": "bogus"}, format="json").status_code == 400


def test_resubscribe_expires_previous_active(client, user):
    client.post("/api/v1/billing/subscribe", {"plan": "paid_2tb"}, format="json")
    client.post("/api/v1/billing/subscribe", {"plan": "paid_5tb"}, format="json")
    assert Subscription.objects.filter(user=user, status="active").count() == 1
    user.refresh_from_db()
    assert user.tier == "paid_5tb"


def test_cancel_retains_access_until_period_end(client, user):
    client.post("/api/v1/billing/subscribe", {"plan": "paid_2tb"}, format="json")
    resp = client.post("/api/v1/billing/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    # tier not immediately downgraded (retained until period end)
    user.refresh_from_db()
    assert user.tier == "paid_2tb"


def test_cancel_without_subscription_is_400(client):
    assert client.post("/api/v1/billing/cancel").status_code == 400


# --- webhook idempotency ----------------------------------------------------

def _payload(event_id="evt_1", event="subscription.charged"):
    return json.dumps({"id": event_id, "event": event}).encode()


def test_webhook_rejects_bad_signature(db):
    resp = APIClient().post("/api/v1/billing/webhook", data=_payload(),
                            content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE="wrong")
    assert resp.status_code == 400


def test_webhook_is_idempotent(db):
    anon = APIClient()
    headers = {"content_type": "application/json", "HTTP_X_RAZORPAY_SIGNATURE": "test-signature"}

    first = anon.post("/api/v1/billing/webhook", data=_payload("evt_dup"), **headers)
    assert first.status_code == 200
    assert first.json()["processed"] is True

    second = anon.post("/api/v1/billing/webhook", data=_payload("evt_dup"), **headers)
    assert second.status_code == 200
    assert second.json()["processed"] is False  # duplicate -> no double processing

    assert WebhookEvent.objects.filter(event_id="evt_dup").count() == 1

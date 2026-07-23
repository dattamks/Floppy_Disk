"""Billing service: subscribe/cancel + idempotent webhook processing."""
from __future__ import annotations

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from .gateways.base import get_payment_gateway
from .models import Subscription, WebhookEvent
from .plans import plan_or_none


class BillingError(Exception):
    pass


@transaction.atomic
def subscribe(user, *, plan_code: str, annual: bool = False) -> Subscription:
    plan = plan_or_none(plan_code)
    if plan is None or plan_code == "free":
        raise BillingError("Unknown or non-purchasable plan.")

    gw = get_payment_gateway().create_subscription(
        user_id=str(user.pk), plan_id=plan_code, annual=annual
    )

    # Deactivate any prior active subscription.
    Subscription.objects.filter(user=user, status=Subscription.Status.ACTIVE).update(
        status=Subscription.Status.EXPIRED
    )
    period = timedelta(days=365 if annual else 30)
    sub = Subscription.objects.create(
        user=user, plan_code=plan_code, status=Subscription.Status.ACTIVE,
        gateway_subscription_id=gw.gateway_subscription_id,
        current_period_end=timezone.now() + period,
    )

    # Apply entitlements: tier + quota.
    user.tier = plan["tier"]
    user.quota_bytes = plan["quota_bytes"]
    user.save(update_fields=["tier", "quota_bytes", "updated_at"])
    return sub


@transaction.atomic
def cancel(user) -> Subscription | None:
    sub = Subscription.objects.filter(user=user, status=Subscription.Status.ACTIVE).first()
    if sub is None:
        return None
    get_payment_gateway().cancel_subscription(
        gateway_subscription_id=sub.gateway_subscription_id, at_period_end=True
    )
    sub.status = Subscription.Status.CANCELLED  # access retained until current_period_end
    sub.save(update_fields=["status", "updated_at"])
    return sub


def process_webhook_event(*, gateway: str, event: dict) -> bool:
    """
    Record + process a webhook event exactly once.
    Returns True if newly processed, False if it was a duplicate.
    """
    event_id = event.get("id")
    if not event_id:
        raise BillingError("Webhook event missing id.")
    try:
        with transaction.atomic():
            WebhookEvent.objects.create(
                gateway=gateway, event_id=event_id, event_type=event.get("type", "")
            )
    except IntegrityError:
        return False  # already processed -> idempotent no-op

    # (Effect handlers — e.g. subscription.charged extends the period — go here.)
    return True

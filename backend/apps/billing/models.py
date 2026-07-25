"""
Billing: subscriptions, referral bonuses, and webhook idempotency (PRD 5.3).
"""
import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Subscription(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"       # access retained to period end
        PAST_DUE = "past_due", "Past due"
        EXPIRED = "expired", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions")
    plan_code = models.CharField(max_length=20)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    gateway_subscription_id = models.CharField(max_length=128, blank=True, default="")
    current_period_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "billing_subscription"
        indexes = [models.Index(fields=["user", "status"])]

    def __str__(self):
        return f"{self.user_id}:{self.plan_code}:{self.status}"


class ReferralBonus(TimeStampedModel):
    """50GB per successful referral, expiring 180 days from grant (PRD 5.3)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="referral_bonuses")
    referee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="referred_by_bonus")
    bytes = models.BigIntegerField(default=50 * 1024**3)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "billing_referral_bonus"


class WebhookEvent(TimeStampedModel):
    """Idempotency ledger for payment-gateway webhooks (PRD Section 6)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gateway = models.CharField(max_length=20, default="razorpay")
    event_id = models.CharField(max_length=128)
    event_type = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        db_table = "billing_webhook_event"
        constraints = [
            models.UniqueConstraint(fields=["gateway", "event_id"], name="uniq_gateway_event"),
        ]

"""
PaymentGateway abstraction.

Phase 1 is Razorpay (India: UPI/cards, GST invoices, native subscription
retries). A global launch swaps in Stripe behind this same interface. Selected
via settings.PAYMENT_GATEWAY.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Subscription:
    gateway_subscription_id: str
    status: str
    current_period_end: str | None = None


class PaymentGateway(ABC):
    @abstractmethod
    def create_subscription(self, *, user_id: str, plan_id: str, annual: bool = False) -> Subscription:
        """Start a subscription (monthly or annual)."""

    @abstractmethod
    def cancel_subscription(self, *, gateway_subscription_id: str, at_period_end: bool = True) -> None:
        """Cancel; access retained to period end when at_period_end=True."""

    @abstractmethod
    def verify_webhook(self, *, payload: bytes, signature: str) -> bool:
        """Verify webhook authenticity (HMAC)."""

    @abstractmethod
    def parse_webhook_event(self, *, payload: bytes) -> dict:
        """Return a normalized event dict; caller handles idempotency by event id."""


def get_payment_gateway() -> PaymentGateway:
    from django.conf import settings
    from django.utils.module_loading import import_string

    return import_string(settings.PAYMENT_GATEWAY)()

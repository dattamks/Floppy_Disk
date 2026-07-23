"""RazorpayGateway — Phase 1 PaymentGateway (stub; wired in the billing slice)."""
from __future__ import annotations

from .base import PaymentGateway, Subscription


class RazorpayGateway(PaymentGateway):
    def create_subscription(self, *, user_id, plan_id, annual=False) -> Subscription:
        raise NotImplementedError("Wired in the billing slice (Razorpay Subscriptions API).")

    def cancel_subscription(self, *, gateway_subscription_id, at_period_end=True) -> None:
        raise NotImplementedError("Wired in the billing slice.")

    def verify_webhook(self, *, payload, signature) -> bool:
        raise NotImplementedError("Wired in the billing slice (HMAC verify).")

    def parse_webhook_event(self, *, payload) -> dict:
        raise NotImplementedError("Wired in the billing slice.")

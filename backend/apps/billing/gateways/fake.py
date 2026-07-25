"""FakePaymentGateway — dev/test gateway that activates subscriptions instantly."""
from __future__ import annotations

import hashlib
import json

from .base import PaymentGateway, Subscription


class FakePaymentGateway(PaymentGateway):
    def create_subscription(self, *, user_id, plan_id, annual=False) -> Subscription:
        sub_id = f"fake_sub_{hashlib.sha256(f'{user_id}:{plan_id}'.encode()).hexdigest()[:12]}"
        return Subscription(gateway_subscription_id=sub_id, status="active")

    def cancel_subscription(self, *, gateway_subscription_id, at_period_end=True) -> None:
        return None

    def verify_webhook(self, *, payload, signature) -> bool:
        # Dev: accept a trivial signature so the flow is exercisable without secrets.
        return signature == "test-signature"

    def parse_webhook_event(self, *, payload) -> dict:
        data = json.loads(payload.decode() if isinstance(payload, (bytes, bytearray)) else payload)
        return {"id": data.get("id"), "type": data.get("event"), "raw": data}

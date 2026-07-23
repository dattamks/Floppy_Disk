"""
Notification dispatch (PRD 5.8).

Single entry point so every producer is decoupled from delivery. Today it
persists an in-app Notification; FCM push / SES email hang off the same call
later (via Celery), and failures here must never break the triggering action.
"""
from __future__ import annotations

from .models import Notification


def notify(user, *, type: str, title: str, body: str = "", data: dict | None = None) -> Notification | None:
    try:
        return Notification.objects.create(
            user=user, type=type, title=title, body=body, data=data or {}
        )
    except Exception:  # noqa: BLE001 - best-effort; never block the caller
        return None


def notify_many(users, *, type: str, title: str, body: str = "", data: dict | None = None) -> int:
    """Fan-out to many recipients (e.g. channel subscribers). Returns count sent."""
    objs = [
        Notification(user=u, type=type, title=title, body=body, data=data or {})
        for u in users
    ]
    if not objs:
        return 0
    Notification.objects.bulk_create(objs)
    return len(objs)

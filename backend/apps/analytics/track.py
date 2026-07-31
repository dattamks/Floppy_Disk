"""track() - the single entry point for recording product analytics."""
from __future__ import annotations

from django.utils import timezone


def track(name: str, *, user=None, **properties):
    """Record an analytics event. Best-effort - never breaks the caller."""
    from .models import AnalyticsEvent
    try:
        return AnalyticsEvent.objects.create(
            name=name, user=user, properties=properties,
            month=timezone.now().strftime("%Y-%m"),
        )
    except Exception:  # noqa: BLE001
        return None

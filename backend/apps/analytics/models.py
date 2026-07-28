"""
Custom product analytics — no third-party vendor.

AnalyticsEvent stores a typed event name + a JSONB properties bag. `month` is
denormalized (YYYY-MM) to make monthly partitioning / retention trivial later.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class AnalyticsEvent(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="analytics_events")
    properties = models.JSONField(default=dict, blank=True)
    month = models.CharField(max_length=7, db_index=True)  # "YYYY-MM"

    class Meta:
        db_table = "analytics_event"
        indexes = [models.Index(fields=["name", "month"])]

    def __str__(self):
        return f"{self.name}@{self.month}"

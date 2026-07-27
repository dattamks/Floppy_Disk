"""
Notifications (PRD 5.8).

In-app now; push (FCM) and email (SES, security/quota-critical only) attach to
the same dispatch path later. Delivery is best-effort and never blocks the
triggering action.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Notification(TimeStampedModel):
    class Type(models.TextChoices):
        SYSTEM = "system", "System"
        QUOTA = "quota", "Quota"
        SECURITY = "security", "Security"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.SYSTEM)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "notifications_notification"
        indexes = [models.Index(fields=["user", "is_read", "-created_at"])]

    def __str__(self):
        return f"{self.type}:{self.user_id}"

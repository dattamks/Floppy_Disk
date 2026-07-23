"""
Moderation & safety (PRD 5.7).

Two-step reporting: a lightweight Flag (surfaces content for review, no action)
vs. a Report (deliberate, triggers reversible isolation before human review).
Reporter identity is always logged internally for abuse-pattern detection.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class ContentReport(TimeStampedModel):
    class Kind(models.TextChoices):
        FLAG = "flag", "Flag"          # lightweight, no automatic action
        REPORT = "report", "Report"    # triggers reversible isolation

    class TargetType(models.TextChoices):
        FILE = "file", "File"
        CHANNEL = "channel", "Channel"
        POST = "post", "Channel post"

    class Reason(models.TextChoices):
        COPYRIGHT = "copyright", "Copyright / IP"
        INAPPROPRIATE = "inappropriate", "Inappropriate content"
        CSAM = "csam", "CSAM"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CONFIRMED = "confirmed", "Confirmed"
        DISMISSED = "dismissed", "Dismissed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="reports_made")
    kind = models.CharField(max_length=8, choices=Kind.choices)
    target_type = models.CharField(max_length=10, choices=TargetType.choices)
    target_id = models.UUIDField()
    reason = models.CharField(max_length=16, choices=Reason.choices, default=Reason.OTHER)
    detail = models.TextField(blank=True, default="")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)

    class Meta:
        db_table = "moderation_content_report"
        indexes = [models.Index(fields=["target_type", "target_id", "status"])]

    def __str__(self):
        return f"{self.kind}:{self.target_type}:{self.target_id}"

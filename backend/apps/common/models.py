"""Shared abstract base models."""
import uuid

from django.db import models


class TimeStampedModel(models.Model):
    """Adds self-updating created/modified timestamps."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Uses a UUID primary key (avoids leaking sequential IDs in URLs/shares)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    """Default base: UUID pk + timestamps."""

    class Meta:
        abstract = True


class Grievance(BaseModel):
    """A grievance filed under the India IT Rules 2021 redressal mechanism."""

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        IN_REVIEW = "in_review", "In review"
        RESOLVED = "resolved", "Resolved"

    # Optional reporter (grievances may be filed by anyone, incl. non-users).
    reporter = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="grievances"
    )
    email = models.EmailField(blank=True, default="")
    subject = models.CharField(max_length=200)
    body = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RECEIVED, db_index=True)

    class Meta:
        db_table = "common_grievance"
        ordering = ["-created_at"]

"""
Channels: broadcast content to many subscribers (PRD 5.4).

Roles: owner / admin / subscriber. Only owner/admin can post; subscribers are
view-only. "Granting posting rights" = the owner promoting a subscriber to admin.
Public channels are discoverable/joinable; private are invite-only.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Channel(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_channels")
    name = models.CharField(max_length=120)
    handle = models.CharField(max_length=40, unique=True)
    description = models.TextField(blank=True, default="")
    is_public = models.BooleanField(default=True)

    class Meta:
        db_table = "channels_channel"
        indexes = [models.Index(fields=["is_public"])]

    def __str__(self):
        return f"@{self.handle}"


class ChannelMembership(TimeStampedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        SUBSCRIBER = "subscriber", "Subscriber"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.SUBSCRIBER)

    class Meta:
        db_table = "channels_membership"
        constraints = [
            models.UniqueConstraint(fields=["channel", "user"], name="uniq_channel_user"),
        ]

    @property
    def can_post(self) -> bool:
        return self.role in (self.Role.OWNER, self.Role.ADMIN)


class ChannelPost(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="posts")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_posts")
    caption = models.TextField(blank=True, default="")
    file = models.ForeignKey("storage.File", null=True, blank=True, on_delete=models.SET_NULL, related_name="channel_posts")

    class Meta:
        db_table = "channels_post"
        indexes = [models.Index(fields=["channel", "-created_at"])]

"""
Sharing: public share links.

A ShareLink grants access to a File (or Folder) via an unguessable token.
Optional expiry; optional password. Private per-user shares (SharePermission)
are a later slice.
"""
import secrets
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


def _make_token() -> str:
    return secrets.token_urlsafe(16)


class ShareLink(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="share_links")
    file = models.ForeignKey("storage.File", null=True, blank=True, on_delete=models.CASCADE, related_name="share_links")
    folder = models.ForeignKey("storage.Folder", null=True, blank=True, on_delete=models.CASCADE, related_name="share_links")

    token = models.CharField(max_length=32, unique=True, default=_make_token, editable=False)
    password_hash = models.CharField(max_length=256, blank=True, default="")  # optional gate
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)

    class Meta:
        db_table = "sharing_share_link"
        indexes = [models.Index(fields=["owner", "revoked"])]

    def __str__(self):
        return f"share:{self.token}"

    @property
    def is_expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= timezone.now()

    @property
    def is_active(self) -> bool:
        return not self.revoked and not self.is_expired

    @property
    def has_password(self) -> bool:
        return bool(self.password_hash)

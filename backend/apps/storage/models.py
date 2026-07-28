"""
Storage core: content-addressed dedup + nested folders + reserve-then-commit.

- StorageObject is the physical, content-hash-addressed blob (deduped PER REGION
  for data residency). File rows reference it; ref_count tracks references and the
  blob is hard-deleted at 0.
- File / Folder are the user-facing tree.
- StorageReservation implements reserve-then-commit quota (closes the TOCTOU race:
  quota is reserved when a presigned upload is issued, committed on completion,
  and auto-released on expiry).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel

# Per-file upload cap (single storage tier, no billing).
MAX_FILE_BYTES = 20 * 1024**3          # 20 GB


class StorageObject(TimeStampedModel):
    """Physical blob, content-hash addressed, deduplicated within a region."""

    class Status(models.TextChoices):
        SCANNING = "scanning", "Scanning"
        READY = "ready", "Ready"
        QUARANTINED = "quarantined", "Quarantined"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content_hash = models.CharField(max_length=64, db_index=True)  # sha256 hex
    region = models.CharField(max_length=16)
    size_bytes = models.BigIntegerField()
    ref_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SCANNING)
    object_key = models.CharField(max_length=512, blank=True, default="")

    class Meta:
        db_table = "storage_object"
        constraints = [
            # Dedup key is per-region, never global (residency).
            models.UniqueConstraint(fields=["content_hash", "region"], name="uniq_hash_per_region"),
        ]

    def __str__(self):
        return f"{self.content_hash[:12]}@{self.region} (refs={self.ref_count})"


class Folder(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="folders")
    name = models.CharField(max_length=255)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    deleted_at = models.DateTimeField(null=True, blank=True)
    # When set, this item was trashed as part of trashing an ancestor folder
    # (that folder's id). Such items are hidden from the top-level Trash view and
    # restored together with that ancestor — never on their own.
    trashed_root = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "storage_folder"
        indexes = [models.Index(fields=["owner", "parent", "deleted_at"])]

    def __str__(self):
        return self.name


class File(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending upload"
        SCANNING = "scanning", "Scanning"
        PROCESSING = "processing", "Processing"  # video transcoding in progress
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    class Kind(models.TextChoices):
        FILE = "file", "File"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        DOC = "doc", "Document"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="files")
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL, related_name="files")
    storage_object = models.ForeignKey(StorageObject, null=True, blank=True, on_delete=models.PROTECT, related_name="files")
    name = models.CharField(max_length=255)
    size_bytes = models.BigIntegerField(default=0)
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.FILE)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    deleted_at = models.DateTimeField(null=True, blank=True)
    # Set when this file was trashed by trashing its ancestor folder (that
    # folder's id): hidden from the Trash view, restored with the folder.
    trashed_root = models.UUIDField(null=True, blank=True, db_index=True)
    # Reversible isolation: set by a failed malware scan or a Report (PRD 5.7).
    is_quarantined = models.BooleanField(default=False)
    # Self-hosted video playback: a browser-playable H.264/AAC MP4 rendition
    # transcoded with FFmpeg (points at storage_object when the upload was
    # already web-playable), an optional JPEG poster frame, and probed metadata.
    playable_object = models.ForeignKey(
        StorageObject, null=True, blank=True, on_delete=models.SET_NULL, related_name="playable_for"
    )
    poster_object = models.ForeignKey(
        StorageObject, null=True, blank=True, on_delete=models.SET_NULL, related_name="poster_for"
    )
    duration_seconds = models.FloatField(null=True, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    # Discovery (PRD 5.4): discoverable content is searchable/browsable by others;
    # mature-tagged content is never surfaced in discovery (PRD 5.5).
    is_discoverable = models.BooleanField(default=False, db_index=True)
    is_mature_content = models.BooleanField(default=False)

    class Meta:
        db_table = "storage_file"
        indexes = [models.Index(fields=["owner", "folder", "deleted_at"])]

    def __str__(self):
        return self.name


class StorageReservation(TimeStampedModel):
    """A pending claim on quota for an in-flight upload (reserve-then-commit)."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMMITTED = "committed", "Committed"
        EXPIRED = "expired", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reservations")
    file = models.ForeignKey(File, null=True, blank=True, on_delete=models.SET_NULL, related_name="reservations")
    bytes = models.BigIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "storage_reservation"
        indexes = [models.Index(fields=["owner", "status", "expires_at"])]

    @property
    def is_live(self):
        return self.status == self.Status.ACTIVE and self.expires_at > timezone.now()

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
        READY = "ready", "Ready"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content_hash = models.CharField(max_length=64, db_index=True)  # sha256 hex
    region = models.CharField(max_length=16)
    size_bytes = models.BigIntegerField()
    ref_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.READY)
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
    # restored together with that ancestor - never on their own.
    trashed_root = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "storage_folder"
        indexes = [models.Index(fields=["owner", "parent", "deleted_at"])]

    def __str__(self):
        return self.name


class File(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending upload"
        PROCESSING = "processing", "Processing"  # video transcoding in progress
        READY = "ready", "Ready"

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
    # Discovery: discoverable content is searchable/browsable by others;
    # mature-tagged content is never surfaced in discovery.
    is_discoverable = models.BooleanField(default=False, db_index=True)
    is_mature_content = models.BooleanField(default=False)
    # User-toggled favourite. Persisted so a star survives a reload / another device.
    starred = models.BooleanField(default=False)
    # User-authored metadata: a free-text description and a list of tags. Both are
    # searchable and shown in the file's Details panel.
    description = models.TextField(blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    # Extracted, searchable text for document-kind files (capped). Populated from
    # the blob on upload-complete / content-edit; empty for media or when the
    # storage backend can't be read locally. Enables full-text (content) search.
    content_text = models.TextField(blank=True, default="")

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


class StorageConfig(TimeStampedModel):
    """Singleton: the instance's active storage choice, set via the owner UI.

    Storage backend resolution is env -> this row -> local default (see
    apps.storage.config.get_effective_storage). The R2 secret is stored
    encrypted (never in plaintext, never returned to a client)."""

    class Backend(models.TextChoices):
        LOCAL = "local", "Local disk"
        R2 = "r2", "Cloudflare R2"

    # Enforced-singleton primary key (always 1).
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    backend = models.CharField(max_length=8, choices=Backend.choices, default=Backend.LOCAL)
    r2_endpoint_url = models.CharField(max_length=300, blank=True, default="")
    r2_access_key_id = models.CharField(max_length=200, blank=True, default="")
    r2_secret_ciphertext = models.TextField(blank=True, default="")  # Fernet token
    r2_bucket = models.CharField(max_length=200, blank=True, default="")
    # R2 storage budget cap (bytes) - a soft ceiling shown in the meter, since
    # R2 has no physical size. Default 10 TB; the owner can change it any time.
    r2_quota_bytes = models.BigIntegerField(default=10 * 1024**4)
    # When True, uploads may exceed r2_quota_bytes (the cap is only a budget
    # indicator); when False the cap is enforced. R2 only - local is always
    # bounded by the real disk. Default True (soft budget).
    allow_overflow = models.BooleanField(default=True)
    # Whether the owner has finished (or dismissed) the first-run setup step.
    setup_completed = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "storage_config"

    def save(self, *args, **kwargs):
        self.id = 1  # never allow a second row
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "StorageConfig":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def r2_is_complete(self) -> bool:
        return bool(
            self.r2_endpoint_url and self.r2_access_key_id
            and self.r2_secret_ciphertext and self.r2_bucket
        )


class StorageMigration(TimeStampedModel):
    """A one-time move of existing local blobs into R2, driven from the owner UI.

    Progress is polled by the UI; the move runs in a background thread. Idempotent
    and resumable - blobs already in R2 are skipped."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        PAUSED = "paused", "Paused"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    total = models.IntegerField(default=0)
    done = models.IntegerField(default=0)
    skipped = models.IntegerField(default=0)
    failed = models.IntegerField(default=0)
    bytes_moved = models.BigIntegerField(default=0)
    delete_local = models.BooleanField(default=False)
    cancel_requested = models.BooleanField(default=False)
    error = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "storage_migration"
        indexes = [models.Index(fields=["status", "created_at"])]

    @property
    def is_active(self) -> bool:
        return self.status in (self.Status.PENDING, self.Status.RUNNING, self.Status.PAUSED)

"""
StorageService abstraction over Cloudflare R2 (S3-compatible).

Everything the app needs from object storage goes through this interface:
presigned direct-to-client uploads (with server-side size limits), presigned
downloads, multipart lifecycle, and cross-region copies for data residency.
Region-pinned buckets come from settings.R2_REGION_BUCKETS.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class PresignedUpload:
    url: str
    fields: dict = field(default_factory=dict)  # POST policy fields (incl. content-length-range)
    object_key: str = ""
    expires_in: int = 3600


class StorageService(ABC):
    """Contract for the object-storage backend (R2 now, unchanged at AWS migration)."""

    @abstractmethod
    def presign_upload(
        self, *, region: str, object_key: str, max_bytes: int, content_type: str | None = None
    ) -> PresignedUpload:
        """Presigned direct-to-R2 upload; enforces max_bytes via content-length-range."""

    @abstractmethod
    def presign_download(self, *, region: str, object_key: str, expires_in: int = 3600) -> str:
        """Time-limited signed GET URL (also used for private-video range streaming)."""

    @abstractmethod
    def create_multipart(self, *, region: str, object_key: str) -> str:
        """Begin a multipart/resumable upload; returns an upload id."""

    @abstractmethod
    def complete_multipart(self, *, region: str, object_key: str, upload_id: str, parts: list) -> None:
        """Finalize a multipart upload."""

    @abstractmethod
    def abort_multipart(self, *, region: str, object_key: str, upload_id: str) -> None:
        """Abort an incomplete multipart upload (orphan cleanup job)."""

    @abstractmethod
    def list_incomplete_multipart(self, *, region: str, older_than_hours: int = 24) -> list:
        """List stale multipart uploads for the daily reclamation job."""

    @abstractmethod
    def copy_object(
        self, *, src_region: str, dst_region: str, src_key: str, dst_key: str
    ) -> None:
        """Copy bytes (same-region = server-side; cross-region = fetch+write)."""

    @abstractmethod
    def delete_object(self, *, region: str, object_key: str) -> None:
        """Hard-delete an object (ref_count reached 0)."""


def get_storage_service() -> StorageService:
    """Return the active storage backend.

    Precedence (mirrors DB selection): environment R2 (operator-configured) →
    the owner-set StorageConfig row (UI) → local disk. Resolved per call so a
    change saved in the UI takes effect immediately, with no restart.
    """
    from django.conf import settings
    from django.utils.module_loading import import_string

    # 1. Environment wins: if R2 (or any explicit STORAGE_SERVICE) is set in the
    #    environment, honor it exactly as before — the UI shows it read-only.
    if getattr(settings, "R2_CONFIGURED", False) or "STORAGE_SERVICE" in os.environ:
        return import_string(settings.STORAGE_SERVICE)()

    # 2. Owner-configured R2 from the database (decrypted secret injected).
    from apps.storage.config import decrypt_secret
    from apps.storage.models import StorageConfig
    from apps.storage.services.r2 import R2StorageService

    cfg = StorageConfig.load()
    if cfg.backend == StorageConfig.Backend.R2 and cfg.r2_is_complete():
        return R2StorageService(
            endpoint_url=cfg.r2_endpoint_url,
            access_key_id=cfg.r2_access_key_id,
            secret_access_key=decrypt_secret(cfg.r2_secret_ciphertext),
            bucket=cfg.r2_bucket,
            region_buckets={},
        )

    # 3. Default: local disk (import the configured default, normally Local).
    return import_string(settings.STORAGE_SERVICE)()

"""
StorageService abstraction over Cloudflare R2 (S3-compatible).

Everything the app needs from object storage goes through this interface:
presigned direct-to-client uploads (with server-side size limits), presigned
downloads, multipart lifecycle, and cross-region copies for data residency.
Region-pinned buckets come from settings.R2_REGION_BUCKETS.
"""
from __future__ import annotations

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
    from django.conf import settings
    from django.utils.module_loading import import_string

    return import_string(settings.STORAGE_SERVICE)()

"""
LocalStorageService — dev/test implementation of StorageService.

Stores blobs on local disk and "presigns" uploads/downloads to a dev-only
Django endpoint, so the full upload flow (presign -> PUT bytes -> complete)
works end-to-end without R2 credentials. Not for production.
"""
from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

from django.conf import settings

from .base import PresignedUpload, StorageService


class LocalStorageService(StorageService):
    def _base(self) -> Path:
        base = Path(settings.DEV_STORAGE_DIR)
        base.mkdir(parents=True, exist_ok=True)
        return base

    def _path(self, region: str, object_key: str) -> Path:
        path = self._base() / region / object_key
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    # --- StorageService interface -------------------------------------------
    def presign_upload(self, *, region, object_key, max_bytes, content_type=None) -> PresignedUpload:
        return PresignedUpload(
            url=f"/api/v1/storage/_dev/blob/{region}/{object_key}",
            fields={"max_bytes": max_bytes},
            object_key=object_key,
        )

    def presign_download(self, *, region, object_key, expires_in=3600) -> str:
        return f"/api/v1/storage/_dev/blob/{region}/{object_key}"

    def create_multipart(self, *, region, object_key) -> str:
        return f"local-multipart-{object_key}"

    def complete_multipart(self, *, region, object_key, upload_id, parts) -> None:
        return None

    def abort_multipart(self, *, region, object_key, upload_id) -> None:
        return None

    def list_incomplete_multipart(self, *, region, older_than_hours=24) -> list:
        return []

    def copy_object(self, *, src_region, dst_region, src_key, dst_key) -> None:
        shutil.copy2(self._path(src_region, src_key), self._path(dst_region, dst_key))

    def delete_object(self, *, region, object_key) -> None:
        self._path(region, object_key).unlink(missing_ok=True)

    # --- dev-only helpers (not part of the interface) -----------------------
    def save_bytes(self, *, region, object_key, data: bytes) -> None:
        self._path(region, object_key).write_bytes(data)

    def read_bytes(self, *, region, object_key) -> bytes:
        return self._path(region, object_key).read_bytes()

    def local_path(self, *, region, object_key):
        """Filesystem path of a stored blob (for range-served media delivery)."""
        return self._path(region, object_key)

    def stat(self, *, region, object_key) -> tuple[int, str]:
        """Return (size_bytes, sha256_hex) of a stored blob."""
        data = self.read_bytes(region=region, object_key=object_key)
        return len(data), hashlib.sha256(data).hexdigest()

"""
R2StorageService — Cloudflare R2 implementation of StorageService via boto3.

R2 speaks the S3 API, so the same boto3 client works, and swapping to S3 at AWS
migration is a config change. Region -> bucket mapping (settings.R2_REGION_BUCKETS)
keeps each user's data in their chosen residency region; dedup is per-region.

NOTE: method bodies are stubs for the foundation pass — the storage slice wires
the real boto3 calls. The interface and client wiring are in place so callers
can be written against them now.
"""
from __future__ import annotations

import functools

import boto3
from botocore.config import Config
from django.conf import settings

from .base import PresignedUpload, StorageService


class R2StorageService(StorageService):
    def _bucket_for(self, region: str) -> str:
        try:
            return settings.R2_REGION_BUCKETS[region]
        except KeyError as exc:
            raise ValueError(f"No R2 bucket configured for region '{region}'") from exc

    @functools.cached_property
    def _client(self):
        return boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )

    def presign_upload(self, *, region, object_key, max_bytes, content_type=None) -> PresignedUpload:
        raise NotImplementedError("Wired in the storage slice (presigned POST + content-length-range).")

    def presign_download(self, *, region, object_key, expires_in=3600) -> str:
        raise NotImplementedError("Wired in the storage slice.")

    def create_multipart(self, *, region, object_key) -> str:
        raise NotImplementedError("Wired in the storage slice.")

    def complete_multipart(self, *, region, object_key, upload_id, parts) -> None:
        raise NotImplementedError("Wired in the storage slice.")

    def abort_multipart(self, *, region, object_key, upload_id) -> None:
        raise NotImplementedError("Wired in the storage slice.")

    def list_incomplete_multipart(self, *, region, older_than_hours=24) -> list:
        raise NotImplementedError("Wired in the orphan-cleanup job.")

    def copy_object(self, *, src_region, dst_region, src_key, dst_key) -> None:
        raise NotImplementedError("Wired in the sharing/copy-on-share slice.")

    def delete_object(self, *, region, object_key) -> None:
        raise NotImplementedError("Wired in the trash-purge job.")

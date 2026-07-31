"""
R2StorageService — Cloudflare R2 implementation of StorageService via boto3.

R2 speaks the S3 API, so the same boto3 client works, and swapping to S3 at AWS
migration is a config change. Region -> bucket mapping keeps each user's data in
their chosen residency region; dedup is per-region. A simple self-host can set a
single ``R2_BUCKET`` instead of the full ``R2_REGION_BUCKETS`` map — every region
then resolves to that one bucket.

The upload path is presigned direct-to-client (the browser/SDK PUTs straight to
R2), so the app server never sees the bytes; ``stat`` reads size + a content
identifier back from R2 (``head_object``) to drive per-region dedup. Server-side
writes we *do* hold in memory — notes, inline edits, video renditions — go
through ``save_bytes`` (``put_object``); ``read_bytes`` fetches small blobs back
for content indexing.
"""
from __future__ import annotations

import functools

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings

from .base import PresignedUpload, StorageService


class R2StorageService(StorageService):
    def _bucket_for(self, region: str) -> str:
        bucket = (settings.R2_REGION_BUCKETS or {}).get(region) or getattr(settings, "R2_BUCKET", "")
        if not bucket:
            raise ValueError(f"No R2 bucket configured for region '{region}'")
        return bucket

    @functools.cached_property
    def _client(self):
        return boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )

    # --- StorageService interface -------------------------------------------
    def presign_upload(self, *, region, object_key, max_bytes, content_type=None) -> PresignedUpload:
        # Presigned POST with a content-length-range policy so the client cannot
        # upload more than the quota it reserved (enforced by R2, not just us).
        fields: dict = {}
        conditions: list = [["content-length-range", 0, int(max_bytes)]]
        if content_type:
            fields["Content-Type"] = content_type
            conditions.append({"Content-Type": content_type})
        post = self._client.generate_presigned_post(
            Bucket=self._bucket_for(region),
            Key=object_key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=3600,
        )
        return PresignedUpload(
            url=post["url"], fields=post["fields"], object_key=object_key, expires_in=3600
        )

    def presign_download(self, *, region, object_key, expires_in=3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket_for(region), "Key": object_key},
            ExpiresIn=expires_in,
        )

    def create_multipart(self, *, region, object_key) -> str:
        r = self._client.create_multipart_upload(Bucket=self._bucket_for(region), Key=object_key)
        return r["UploadId"]

    def complete_multipart(self, *, region, object_key, upload_id, parts) -> None:
        self._client.complete_multipart_upload(
            Bucket=self._bucket_for(region),
            Key=object_key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )

    def abort_multipart(self, *, region, object_key, upload_id) -> None:
        self._client.abort_multipart_upload(
            Bucket=self._bucket_for(region), Key=object_key, UploadId=upload_id
        )

    def list_incomplete_multipart(self, *, region, older_than_hours=24) -> list:
        from datetime import timedelta

        from django.utils import timezone

        cutoff = timezone.now() - timedelta(hours=older_than_hours)
        resp = self._client.list_multipart_uploads(Bucket=self._bucket_for(region))
        stale = []
        for up in resp.get("Uploads", []):
            initiated = up.get("Initiated")
            if initiated is None or initiated <= cutoff:
                stale.append({"object_key": up.get("Key"), "upload_id": up.get("UploadId")})
        return stale

    def copy_object(self, *, src_region, dst_region, src_key, dst_key) -> None:
        # R2 buckets share one account endpoint, so a server-side copy works for
        # same- and cross-region alike (no fetch+rewrite needed).
        self._client.copy_object(
            Bucket=self._bucket_for(dst_region),
            Key=dst_key,
            CopySource={"Bucket": self._bucket_for(src_region), "Key": src_key},
        )

    def delete_object(self, *, region, object_key) -> None:
        self._client.delete_object(Bucket=self._bucket_for(region), Key=object_key)

    # --- server-side byte access (used via hasattr by callers) --------------
    def save_bytes(self, *, region, object_key, data: bytes) -> None:
        """Write bytes we already hold (notes, inline edits, video renditions)."""
        self._client.put_object(Bucket=self._bucket_for(region), Key=object_key, Body=data)

    def read_bytes(self, *, region, object_key) -> bytes:
        """Fetch a blob's bytes (content indexing; caller bounds the size)."""
        r = self._client.get_object(Bucket=self._bucket_for(region), Key=object_key)
        return r["Body"].read()

    def stat(self, *, region, object_key) -> tuple[int, str]:
        """Return (size_bytes, content_hash) for a directly-uploaded blob.

        The app server never saw the bytes (direct-to-R2 upload), so the content
        identifier comes from R2's ETag — the MD5 of the object for a single-part
        upload. That's a stable per-content key, which is all dedup needs (a
        multipart ETag isn't a plain MD5, so those simply dedup less often).
        """
        try:
            head = self._client.head_object(Bucket=self._bucket_for(region), Key=object_key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code in ("404", "NoSuchKey", "NotFound"):
                raise FileNotFoundError(object_key) from exc
            raise
        size = int(head["ContentLength"])
        etag = (head.get("ETag") or "").strip('"')
        return size, etag

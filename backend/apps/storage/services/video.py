"""
VideoService abstraction over Cloudflare Stream (PRD 5.5).

Private video streams directly from R2 (zero egress); video that becomes
discoverable/public is promoted into Stream for adaptive HLS. Dev/tests use a
FakeVideoService. Selected via settings.VIDEO_SERVICE.
"""
from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod


class VideoService(ABC):
    @abstractmethod
    def promote(self, *, region: str, object_key: str) -> str:
        """Ingest an R2 object into Stream; return the stream_uid."""

    @abstractmethod
    def hls_url(self, *, stream_uid: str) -> str:
        """Return the HLS manifest URL for a promoted asset."""

    @abstractmethod
    def delete(self, *, stream_uid: str) -> None:
        """Remove a promoted asset from Stream (hot-cache eviction)."""


class FakeVideoService(VideoService):
    def promote(self, *, region, object_key) -> str:
        return "fake_" + hashlib.sha256(f"{region}:{object_key}".encode()).hexdigest()[:16]

    def hls_url(self, *, stream_uid) -> str:
        return f"/api/v1/public/stream/{stream_uid}/manifest.m3u8"

    def delete(self, *, stream_uid) -> None:
        return None


class CloudflareStreamService(VideoService):
    def promote(self, *, region, object_key) -> str:
        raise NotImplementedError("Wired for production (Stream copy-from-URL API).")

    def hls_url(self, *, stream_uid) -> str:
        from django.conf import settings
        return f"https://customer-{settings.CLOUDFLARE_STREAM_ACCOUNT_ID}.cloudflarestream.com/{stream_uid}/manifest/video.m3u8"

    def delete(self, *, stream_uid) -> None:
        raise NotImplementedError("Wired for production.")


def get_video_service() -> "VideoService":
    from django.conf import settings
    from django.utils.module_loading import import_string

    return import_string(settings.VIDEO_SERVICE)()

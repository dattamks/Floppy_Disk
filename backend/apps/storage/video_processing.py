"""
Self-hosted video processing: probe an uploaded video, transcode it to a
browser-playable MP4 when needed, and grab a poster frame — all on our own
servers with FFmpeg (no Cloudflare Stream, no external service).

Called as a background task right after upload completes. The original bytes
are always kept; `File.playable_object` points at the transcoded rendition
(or at the original when it was already web-playable).
"""
from __future__ import annotations

import hashlib
import logging

from django.db.models import F

from .models import File, StorageObject
from .services.base import get_storage_service
from .services.transcode import get_media_transcoder

logger = logging.getLogger(__name__)


def _store_rendition(storage, *, region: str, object_key: str, data: bytes) -> StorageObject:
    """Persist derived bytes as a content-addressed StorageObject (per-region dedup)."""
    content_hash = hashlib.sha256(data).hexdigest()
    obj, _created = StorageObject.objects.get_or_create(
        content_hash=content_hash,
        region=region,
        defaults={"size_bytes": len(data), "status": StorageObject.Status.READY, "object_key": object_key},
    )
    # Write the bytes under the object's canonical key (dev/local backend).
    if hasattr(storage, "save_bytes"):
        storage.save_bytes(region=region, object_key=obj.object_key or object_key, data=data)
    StorageObject.objects.filter(pk=obj.pk).update(ref_count=F("ref_count") + 1)
    obj.refresh_from_db()
    return obj


def process_video(file_id) -> None:
    """Probe, transcode (if needed), and poster a just-uploaded video.

    Idempotent and defensive: any failure falls back to serving the original
    file so playback still has a URL, and the file always ends up `ready`.
    """
    file = (
        File.objects.filter(pk=file_id, kind=File.Kind.VIDEO, deleted_at__isnull=True)
        .select_related("storage_object")
        .first()
    )
    if file is None or file.storage_object_id is None:
        return

    storage = get_storage_service()
    obj = file.storage_object

    # Production R2 completion (streaming download) isn't wired yet; without
    # local bytes we can't transcode, so serve the original as-is.
    if not hasattr(storage, "read_bytes"):
        _finalize(file, playable=obj)
        return

    try:
        data = storage.read_bytes(region=obj.region, object_key=obj.object_key)
    except FileNotFoundError:
        _finalize(file, playable=obj)
        return

    transcoder = get_media_transcoder()
    poster_obj = None
    playable_obj = obj

    try:
        meta = transcoder.probe(data=data, filename=file.name)
        file.duration_seconds = meta.duration_seconds
        file.width = meta.width
        file.height = meta.height

        if not meta.is_web_playable:
            mp4 = transcoder.transcode_to_mp4(data=data)
            playable_obj = _store_rendition(
                storage, region=obj.region, object_key=f"{obj.object_key}.play.mp4", data=mp4
            )
    except Exception:  # noqa: BLE001 - never leave a video stuck; fall back to the original
        logger.exception("Video transcode failed for file %s; serving original", file.id)
        playable_obj = obj

    try:
        poster_bytes = transcoder.poster(data=data)
        poster_obj = _store_rendition(
            storage, region=obj.region, object_key=f"{obj.object_key}.poster.jpg", data=poster_bytes
        )
    except Exception:  # noqa: BLE001 - poster is optional
        logger.warning("Poster generation failed for file %s", file.id, exc_info=True)

    _finalize(file, playable=playable_obj, poster=poster_obj)


def _finalize(file: File, *, playable: StorageObject, poster: StorageObject | None = None) -> None:
    file.playable_object = playable
    if poster is not None:
        file.poster_object = poster
    file.status = File.Status.READY
    file.save(
        update_fields=[
            "playable_object", "poster_object", "duration_seconds",
            "width", "height", "status", "updated_at",
        ]
    )

"""Content indexing for full-text search.

Document-kind files get their text extracted from the stored blob and cached on
``File.content_text`` so search can match file *contents*, not just names. This
runs on upload-complete and on content-edit, best-effort: media files, oversized
blobs, and remote-only storage backends are skipped (content_text stays empty
and search falls back to the filename).

Reuses the same bounded, local-read approach as the knowledge-graph reference
scanner, so it never turns into a large or remote fetch.
"""
from __future__ import annotations

from .models import File

# Read cap: don't pull huge blobs just to index them.
_MAX_INDEX_BYTES = 256 * 1024
# Stored-text cap: keep the DB row and any FTS vector bounded.
_MAX_TEXT_CHARS = 100_000


def extract_text(file: File) -> str:
    """Best-effort UTF-8 text of a document file's blob, capped; else ""."""
    if file.kind != File.Kind.DOC or not file.storage_object_id:
        return ""
    obj = file.storage_object
    if not obj or (obj.size_bytes or 0) > _MAX_INDEX_BYTES:
        return ""
    from .services.base import get_storage_service

    storage = get_storage_service()
    # Only index when we can read bytes here (local dev / self-host). Remote R2
    # is left to a future async indexer rather than fetched on the hot path.
    if not hasattr(storage, "read_bytes"):
        return ""
    try:
        raw = storage.read_bytes(region=obj.region, object_key=obj.object_key)
    except Exception:  # noqa: BLE001 - missing/unreadable blob is fine; skip.
        return ""
    return raw.decode("utf-8", "ignore")[:_MAX_TEXT_CHARS]


def reindex_file(file: File) -> None:
    """Refresh ``file.content_text`` from its blob (best-effort, no-op on media).

    Also notifies the pluggable search service's index() hook so an external
    engine (OpenSearch, later) can be kept in sync from the same call site.
    """
    text = extract_text(file)
    if text != (file.content_text or ""):
        file.content_text = text
        file.save(update_fields=["content_text"])
    try:
        from .services.base import get_storage_service  # noqa: F401
        from apps.search.services.base import get_search_service

        get_search_service().index(
            doc_id=str(file.id), doc_type="file",
            fields={"name": file.name, "content": text},
        )
    except Exception:  # noqa: BLE001 - indexing is best-effort, never fatal.
        pass

"""Content indexing + media metadata for full-text search.

Document- and image-kind files get their text extracted (and images their pixel
dimensions read) from the stored blob and cached on the File row, so search can
match file *contents* - not just names - and the Details panel can show
resolution. This runs on upload-complete and on content-edit, best-effort:
oversized blobs and remote-only storage backends are skipped.

Text extraction covers, in order of availability:
  * plain text / Markdown / code     -> decoded directly (always)
  * PDF                              -> `pypdf` if installed (optional)
  * scanned images & image-only PDFs -> Tesseract OCR via `pytesseract`+Pillow
                                        if both the packages and the `tesseract`
                                        binary are present (optional)
The optional paths degrade to "" when their dependency is missing, so the core
product runs without them and a deployment that installs them gets richer search.
"""
from __future__ import annotations

import logging

from .mediameta import image_dimensions
from .models import File

log = logging.getLogger("storage.indexing")

# Read cap: don't pull huge blobs just to index them.
_MAX_INDEX_BYTES = 2 * 1024 * 1024
# Stored-text cap: keep the DB row and any FTS vector bounded.
_MAX_TEXT_CHARS = 100_000
# Header slice big enough to carry image dimensions for any supported format.
_HEADER_BYTES = 64 * 1024


def _read_blob(file: File, limit: int):
    """Up to `limit` bytes of a file's blob, or None if it can't be read here."""
    if not file.storage_object_id:
        return None
    obj = file.storage_object
    if not obj:
        return None
    from .services.base import get_storage_service

    storage = get_storage_service()
    # Prefer a bounded local read (no full-blob fetch); fall back to read_bytes.
    lp = getattr(storage, "local_path", None)
    if callable(lp):
        try:
            with open(lp(region=obj.region, object_key=obj.object_key), "rb") as fh:
                return fh.read(limit)
        except OSError:
            return None
    if not hasattr(storage, "read_bytes") or (obj.size_bytes or 0) > limit:
        return None
    try:
        return storage.read_bytes(region=obj.region, object_key=obj.object_key)[:limit]
    except Exception:  # noqa: BLE001 - missing/unreadable blob is fine; skip.
        return None


# ---------------------------------------------------------------- text ------
def _pdf_text(data: bytes) -> str:
    """Extract embedded text from a PDF, or "" if pypdf isn't installed / fails."""
    try:
        import io

        from pypdf import PdfReader
    except Exception:  # noqa: BLE001 - optional dependency
        return ""
    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:  # noqa: BLE001 - a malformed PDF is not fatal
        return ""


def _ocr(data: bytes) -> str:
    """OCR an image (or rendered page) with Tesseract, or "" if unavailable."""
    try:
        import io

        import pytesseract
        from PIL import Image
    except Exception:  # noqa: BLE001 - optional dependencies
        return ""
    try:
        return pytesseract.image_to_string(Image.open(io.BytesIO(data)))
    except Exception:  # noqa: BLE001 - no tesseract binary / unreadable image
        return ""


def extract_text(file: File) -> str:
    """Best-effort searchable text for a file's blob, capped; else ""."""
    if file.kind not in (File.Kind.DOC, File.Kind.IMAGE):
        return ""
    data = _read_blob(file, _MAX_INDEX_BYTES)
    if not data:
        return ""
    text = ""
    if file.kind == File.Kind.IMAGE:
        text = _ocr(data)  # scanned/handwritten images -> text (optional)
    elif data[:5] == b"%PDF-" or file.name.lower().endswith(".pdf"):
        text = _pdf_text(data)
        if not text.strip():
            text = _ocr(data)  # image-only ("scanned") PDF
    else:
        text = data.decode("utf-8", "ignore")
    return (text or "")[:_MAX_TEXT_CHARS]


# ------------------------------------------------------------ dimensions ----
def probe_media(file: File) -> None:
    """Populate width/height for image files from the blob header (best-effort)."""
    if file.kind != File.Kind.IMAGE or (file.width and file.height):
        return
    data = _read_blob(file, _HEADER_BYTES)
    if not data:
        return
    dims = image_dimensions(data)
    if dims:
        file.width, file.height = dims
        file.save(update_fields=["width", "height", "updated_at"])


# ------------------------------------------------------------- reindex ------
def reindex_file(file: File) -> None:
    """Refresh media metadata + ``content_text`` from the blob (best-effort)."""
    probe_media(file)
    text = extract_text(file)
    if text != (file.content_text or ""):
        file.content_text = text
        file.save(update_fields=["content_text"])
    try:
        from apps.search.services.base import get_search_service

        get_search_service().index(
            doc_id=str(file.id), doc_type="file",
            fields={"name": file.name, "content": text},
        )
    except Exception:  # noqa: BLE001 - indexing is best-effort, never fatal.
        pass

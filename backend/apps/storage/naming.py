"""Name de-duplication for files & folders (Drive-style "naming sense").

Keeps names unique among *active* siblings by appending " (2)", " (3)", … -
preserving a file's extension ("report.pdf" -> "report (2).pdf"). Used on
create, rename, move, and restore so a collision never produces two
indistinguishable items in the same place.
"""
from __future__ import annotations

import mimetypes
import re
import os

_SUFFIX_RE = re.compile(r"^(?P<base>.*?)(?: \((?P<n>\d+)\))?$")

# Document-ish extensions that mimetypes may miss or map to non-text types but
# which we still want scanned as documents (so the knowledge graph reads them).
_DOC_EXTS = {
    ".txt", ".md", ".markdown", ".rst", ".json", ".yaml", ".yml", ".csv",
    ".tsv", ".pdf", ".log", ".xml", ".html", ".htm", ".ini", ".toml", ".cfg",
    ".conf", ".env",
}
_DOC_MIMES = {
    "application/json", "application/xml", "application/x-yaml",
    "application/yaml", "application/pdf", "application/toml",
}


def classify_kind(name: str, content_type: str | None = None, fallback: str = "file") -> str:
    """Best-effort media kind for a file from its name/content-type.

    Mirrors the SPA's kindOf(): video/image/audio by MIME family, common
    text/document types as "doc", otherwise ``fallback``. The server does this
    so REST/MCP uploads that omit ``kind`` still classify correctly - otherwise
    every programmatic upload defaults to the generic "file" kind and the
    knowledge graph never scans documents for cross-references.

    Returns a File.Kind value (as its string, e.g. "doc"); import-free at call
    time so this stays usable from serializers and the upload view alike.
    """
    mime = (content_type or mimetypes.guess_type(name)[0] or "").lower().split(";")[0].strip()
    if mime.startswith("video"):
        return "video"
    if mime.startswith("image"):
        return "image"
    if mime.startswith("audio"):
        return "audio"
    _, ext = _split_ext(name)
    if mime.startswith("text") or mime in _DOC_MIMES or ext.lower() in _DOC_EXTS:
        return "doc"
    return fallback


# Characters that must never appear in a stored display name: path separators
# (which could confuse any name-based path handling) and ASCII control chars
# (which corrupt listings, logs, and downloads). We strip rather than reject so
# a paste with a stray slash still yields a usable name instead of an error.
_UNSAFE_RE = re.compile(r"[\x00-\x1f\x7f/\\]")


def sanitize_name(name: str) -> str:
    """Clean a user-supplied file/folder name to a safe display string.

    Removes path separators and control characters, collapses surrounding
    whitespace, caps length at 255, and maps the reserved names "." and ".."
    to empty so the caller's own empty-name check rejects them. Returns "" when
    nothing usable remains. Applied on every create/rename/note path so no
    exposed endpoint can persist a name with a slash or control byte.
    """
    cleaned = _UNSAFE_RE.sub("", name or "").strip()
    if cleaned in (".", ".."):
        return ""
    return cleaned[:255]


def _split_ext(name: str) -> tuple[str, str]:
    # Treat a leading dot as part of the stem (".env" is not an extension).
    root, ext = os.path.splitext(name)
    if not root:
        return name, ""
    return root, ext


def unique_name(name: str, existing: set[str]) -> str:
    """Return `name`, or the first "name (n)" variant not in `existing`."""
    if name not in existing:
        return name
    base, ext = _split_ext(name)
    # Strip an existing " (n)" so we count up from the real base, not "x (2) (2)".
    m = _SUFFIX_RE.match(base)
    if m and m.group("n"):
        base = m.group("base")
    n = 2
    while f"{base} ({n}){ext}" in existing:
        n += 1
    return f"{base} ({n}){ext}"

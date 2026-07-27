"""Name de-duplication for files & folders (Drive-style "naming sense").

Keeps names unique among *active* siblings by appending " (2)", " (3)", … —
preserving a file's extension ("report.pdf" -> "report (2).pdf"). Used on
create, rename, move, and restore so a collision never produces two
indistinguishable items in the same place.
"""
from __future__ import annotations

import re
import os

_SUFFIX_RE = re.compile(r"^(?P<base>.*?)(?: \((?P<n>\d+)\))?$")


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

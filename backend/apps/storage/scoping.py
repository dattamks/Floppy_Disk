"""
Folder scoping for API keys — the single chokepoint every read/write funnels
through so a folder-scoped key can only ever touch its own subtree.

Design: a Bearer API key may carry a `root_folder` (see accounts.ApiKey). When
it does, the request is confined to that folder plus all descendants — for
listing, detail, download, rename/move/delete, upload target, search, AND the
knowledge graph (graph reads call `scoped_folder_ids` too). A request with no
key, or a key with no `root_folder` (session users, full-access keys), is
unrestricted. Building the graph is global and trusted; *reading* it is scoped
here, exactly like the file store — one filter, no per-view divergence.

`request.auth` is the ApiKey instance for Bearer auth and None for session auth
(DRF sets it from the authenticator's return value), so the scope travels with
the credential automatically.
"""
from __future__ import annotations

import uuid

from .models import Folder


def key_root_folder_id(request):
    """The folder id a Bearer key is confined to, or None if unrestricted."""
    return getattr(getattr(request, "auth", None), "root_folder_id", None)


def scoped_folder_ids(request):
    """Set of folder ids visible to this request, or None if unrestricted.

    Includes the scope root and every structural descendant (ignoring
    soft-delete, so a scoped key can still see/restore its own trash). Cached on
    the request — the subtree is walked once per request, not per view.
    """
    root_id = key_root_folder_id(request)
    if not root_id:
        return None
    cached = getattr(request, "_scoped_folder_ids", None)
    if cached is not None:
        return cached
    ids = {root_id}
    frontier = [root_id]
    while frontier:
        kids = list(
            Folder.objects.filter(parent_id__in=frontier)
            .exclude(pk__in=ids)
            .values_list("pk", flat=True)
        )
        if not kids:
            break
        ids.update(kids)
        frontier = kids
    try:
        request._scoped_folder_ids = ids
    except (AttributeError, TypeError):  # pragma: no cover - request is normally mutable
        pass
    return ids


def scope_files(qs, request):
    """Restrict a File queryset to the request's visible folders (subtree)."""
    ids = scoped_folder_ids(request)
    if ids is None:
        return qs
    return qs.filter(folder_id__in=ids)


def scope_folders(qs, request):
    """Restrict a Folder queryset to the request's visible folders (subtree)."""
    ids = scoped_folder_ids(request)
    if ids is None:
        return qs
    return qs.filter(pk__in=ids)


def folder_in_scope(request, folder_id) -> bool:
    """Is this folder id reachable by the request? (None target = storage root,
    which is only in scope for unrestricted requests.)"""
    ids = scoped_folder_ids(request)
    if ids is None:
        return True
    if folder_id is None:
        return False  # storage root is outside any folder scope
    try:
        fid = folder_id if isinstance(folder_id, uuid.UUID) else uuid.UUID(str(folder_id))
    except (ValueError, TypeError, AttributeError):
        return False  # unparseable id can't be in scope
    return fid in ids


def is_scoped(request) -> bool:
    return key_root_folder_id(request) is not None

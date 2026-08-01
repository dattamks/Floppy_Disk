"""
Deterministic graph builder - no LLM, no embeddings, no vector store.

Turns a user's live folders and files into nodes, and derives edges from
signals that are fully explainable:

  * CONTAINS      folder -> child folder/file          (EXTRACTED)
  * SHARED_TOKEN  sibling files sharing a name token   (INFERRED)

The semantic/"INFERRED-by-a-model" enrichment Graphify does for prose/PDFs is
intentionally left to the *connecting client's* LLM: the server ships this
deterministic graph + metadata, the model reasons over it. Rebuild is a full,
idempotent recompute (simple and correct); it's cheap for personal-scale stores
and runs in a Celery task off the request path.
"""
from __future__ import annotations

import re

from django.db import transaction
from django.utils import timezone

from apps.storage.models import File, Folder

from .models import GraphBuild, GraphEdge, GraphNode, NodeKind, Provenance

# Name tokens too generic to imply a real relationship.
_STOPWORDS = {
    "copy", "final", "draft", "new", "old", "img", "image", "photo", "pic",
    "doc", "file", "untitled", "screenshot", "the", "and", "for", "version",
    "final", "temp", "test", "scan", "download",
}
# A token shared by more than this many files is noise, not a relationship.
_MAX_TOKEN_GROUP = 8
# REFERENCES scanning: only read small text/doc blobs, and cap fan-out per file.
_MAX_SCAN_BYTES = 64 * 1024
_MAX_REFS_PER_FILE = 25
# Markdown link target: the "(...)" in [label](target). Path-like token: any
# word that carries a file extension (matches "budget.json", "./docs/x.md").
# Wiki-link: [[Note]] / [[Note|alias]] / [[Note#heading]] - the note name.
# Brackets may be backslash-escaped (\[\[…\]\]) when a WYSIWYG editor's Markdown
# serializer escapes them, so tolerate an optional backslash before each "[" and
# stop the capture at "\", "]", "|", or "#".
_MD_LINK_RE = re.compile(r"\]\(\s*<?([^)\s>]+)")
_PATHY_RE = re.compile(r"[\w./\-]+\.[A-Za-z0-9]{1,8}")
_WIKILINK_RE = re.compile(r"\\?\[\\?\[\s*([^\]|#\\]+)")


def _tokens(name: str) -> set[str]:
    """Normalized name tokens (drop the extension, short/numeric/stopword bits)."""
    stem = re.sub(r"\.[A-Za-z0-9]{1,8}$", "", name or "")
    out = set()
    for tok in re.split(r"[^A-Za-z0-9]+", stem.lower()):
        if len(tok) >= 3 and not tok.isdigit() and tok not in _STOPWORDS:
            out.add(tok)
    return out


@transaction.atomic
def rebuild_user_graph(user) -> dict:
    """Recompute the whole graph for one user. Returns {nodes, edges}."""
    GraphEdge.objects.filter(owner=user).delete()
    GraphNode.objects.filter(owner=user).delete()

    folders = list(Folder.objects.filter(owner=user, deleted_at__isnull=True))
    files = list(
        File.objects.filter(owner=user, deleted_at__isnull=True, status=File.Status.READY)
    )

    # --- nodes ---
    folder_node = {}   # folder_id -> GraphNode
    file_node = {}     # file_id -> GraphNode
    nodes = []
    for fo in folders:
        n = GraphNode(
            owner=user, kind=NodeKind.FOLDER, folder=fo, label=fo.name,
            node_type="folder", scope_folder_id=fo.id,
            meta={"folder_id": str(fo.id), "parent_id": str(fo.parent_id) if fo.parent_id else None},
        )
        folder_node[fo.id] = n
        nodes.append(n)
    for fi in files:
        n = GraphNode(
            owner=user, kind=NodeKind.FILE, file=fi, label=fi.name,
            node_type=fi.kind, scope_folder_id=fi.folder_id,
            meta={"file_id": str(fi.id), "kind": fi.kind, "size_bytes": fi.size_bytes,
                  "folder_id": str(fi.folder_id) if fi.folder_id else None},
        )
        file_node[fi.id] = n
        nodes.append(n)
    GraphNode.objects.bulk_create(nodes)

    # --- edges ---
    edges: list[GraphEdge] = []
    seen: set[tuple] = set()

    def _add(src, tgt, rel, provenance, reason):
        if src is None or tgt is None or src.id == tgt.id:
            return
        key = (src.id, tgt.id, rel)
        if key in seen:
            return
        seen.add(key)
        edges.append(GraphEdge(owner=user, source=src, target=tgt, rel=rel,
                               provenance=provenance, reason=reason))

    # CONTAINS: folder -> child folder, folder -> child file.
    for fo in folders:
        if fo.parent_id in folder_node:
            _add(folder_node[fo.parent_id], folder_node[fo.id],
                 GraphEdge.Rel.CONTAINS, Provenance.EXTRACTED, "parent folder contains subfolder")
    for fi in files:
        if fi.folder_id in folder_node:
            _add(folder_node[fi.folder_id], file_node[fi.id],
                 GraphEdge.Rel.CONTAINS, Provenance.EXTRACTED, "folder contains file")

    # SHARED_TOKEN: files in the same folder sharing a name token. Group by
    # (folder_id, token); connect each group as a star from its first file so
    # edge count stays linear, and skip over-common tokens.
    groups: dict[tuple, list] = {}
    for fi in files:
        for tok in _tokens(fi.name):
            groups.setdefault((fi.folder_id, tok), []).append(fi)
    for (folder_id, tok), members in groups.items():
        if not (2 <= len(members) <= _MAX_TOKEN_GROUP):
            continue
        hub = file_node[members[0].id]
        for other in members[1:]:
            _add(hub, file_node[other.id], GraphEdge.Rel.SHARED_TOKEN,
                 Provenance.INFERRED, f'both named "{tok}"')

    # REFERENCES: a small text/doc file that literally names another file.
    # Deterministic (plain substring match), best-effort (skips on any read
    # error), and bounded (doc-kind + size cap + per-file fan-out cap) so a
    # rebuild never turns into a big storage read.
    _add_reference_edges(files, file_node, _add)

    GraphEdge.objects.bulk_create(edges)

    GraphBuild.objects.update_or_create(
        owner=user,
        defaults={"built_at": timezone.now(), "node_count": len(nodes), "edge_count": len(edges)},
    )
    return {"nodes": len(nodes), "edges": len(edges)}


def _add_reference_edges(files, file_node, add) -> None:
    """Link a document to files it references - via Markdown links, path-like
    tokens, or plain-prose mentions of another file's name. Deterministic and
    bounded; reuses the file's cached ``content_text`` (from search indexing)
    and only reads a blob as a fallback for un-indexed documents."""
    from .models import GraphEdge, Provenance

    # Lookups by full name and by stem (name without extension), lowercased.
    by_name: dict[str, object] = {}
    by_stem: dict[str, object] = {}
    for f in files:
        if not f.name or len(f.name) < 4:
            continue
        by_name.setdefault(f.name.lower(), f)
        stem = f.name.rsplit(".", 1)[0].lower()
        if len(stem) >= 4:
            by_stem.setdefault(stem, f)
    if len(by_name) < 2:
        return

    storage = _read_storage()

    for src in files:
        if src.kind != File.Kind.DOC:
            continue
        text = src.content_text or ""
        if not text and src.storage_object_id and storage is not None:
            obj = src.storage_object
            if obj and (obj.size_bytes or 0) <= _MAX_SCAN_BYTES:
                try:
                    text = storage.read_bytes(region=obj.region, object_key=obj.object_key).decode("utf-8", "ignore")
                except Exception:  # noqa: BLE001 - a missing/unreadable blob is fine
                    text = ""
        if not text:
            continue
        low = text.lower()

        seen: set = set()
        made = 0

        def emit(tgt, reason):
            nonlocal made
            if tgt is None or tgt.id == src.id or tgt.id in seen or made >= _MAX_REFS_PER_FILE:
                return
            seen.add(tgt.id)
            add(file_node[src.id], file_node[tgt.id], GraphEdge.Rel.REFERENCES,
                Provenance.EXTRACTED, reason)
            made += 1

        # 1. Wiki-links: [[Note]] / [[Note|alias]] / [[Note#heading]].
        for m in _WIKILINK_RE.finditer(text):
            if made >= _MAX_REFS_PER_FILE:
                break
            tgt = m.group(1).strip().lower().rsplit("/", 1)[-1]
            emit(by_name.get(tgt) or by_stem.get(tgt.rsplit(".", 1)[0]) or by_stem.get(tgt),
                 "wiki-link")

        # 2. Markdown link targets: [label](target) / [label](path/target#frag).
        for m in _MD_LINK_RE.finditer(text):
            if made >= _MAX_REFS_PER_FILE:
                break
            tgt = m.group(1).split("#")[0].split("?")[0].strip().lower().rsplit("/", 1)[-1]
            emit(by_name.get(tgt) or by_stem.get(tgt.rsplit(".", 1)[0]), "linked in Markdown")

        # 3. Path-like / filename tokens anywhere in the text (e.g. ./docs/x.md).
        for m in _PATHY_RE.finditer(low):
            if made >= _MAX_REFS_PER_FILE:
                break
            emit(by_name.get(m.group(0).rsplit("/", 1)[-1]), "path reference")

        # 4. Plain prose mentions of a full filename (fallback; also names w/o ext).
        for name_l, tgt in by_name.items():
            if made >= _MAX_REFS_PER_FILE:
                break
            if name_l in low:
                emit(tgt, f'text names "{tgt.name}"')


def _read_storage():
    """The storage backend if it can read bytes here (local dev/self-host), else
    None - REFERENCES scanning is skipped rather than fetching from remote R2."""
    try:
        from apps.storage.services.base import get_storage_service
        storage = get_storage_service()
    except Exception:  # noqa: BLE001
        return None
    return storage if hasattr(storage, "read_bytes") else None


def ensure_fresh(user) -> None:
    """Rebuild the graph if it's missing or stale.

    Stale = a file/folder changed after the last build. This keeps reads correct
    without hooking every mutating view or firing global signals; the cost is two
    cheap MAX(updated_at) probes and only pays when the graph is actually read.
    """
    from django.db.models import Max

    build = GraphBuild.objects.filter(owner=user).first()
    if build is None or build.built_at is None:
        rebuild_user_graph(user)
        return
    f_latest = File.objects.filter(owner=user).aggregate(m=Max("updated_at"))["m"]
    d_latest = Folder.objects.filter(owner=user).aggregate(m=Max("updated_at"))["m"]
    latest = max([t for t in (f_latest, d_latest) if t is not None], default=None)
    if latest is not None and latest > build.built_at:
        rebuild_user_graph(user)

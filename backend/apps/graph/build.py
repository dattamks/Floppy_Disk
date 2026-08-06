"""
Deterministic graph builder - no LLM, no embeddings, no vector store.

Turns a user's live folders and files into nodes, and derives edges from
signals that are fully explainable:

  * CONTAINS      folder -> child folder/file          (EXTRACTED)
  * REFERENCES    a file that names another file        (EXTRACTED)
  * SHARED_TOKEN  sibling files sharing a name token    (INFERRED)
  * SHARED_TAG    files sharing a user-applied tag      (INFERRED)

Each file node also carries the user-authored description + tags and any
extracted media metadata in its ``meta``, and a file's description is scanned
for REFERENCES too - so metadata added from the UI, API, or MCP shows up in the
graph on the next read. Tables and their rows are nodes as well (folder CONTAINS
table, table CONTAINS row), with each row carrying a name-keyed preview of its
cells - so structured data is queryable context, not just files.

The semantic/"INFERRED-by-a-model" enrichment Graphify does for prose/PDFs is
intentionally left to the *connecting client's* LLM: the server ships this
deterministic graph + metadata, the model reasons over it. Rebuild is a full,
idempotent recompute (simple and correct); it's cheap for personal-scale stores
and runs in a Celery task off the request path.
"""
from __future__ import annotations

import logging
import re
import threading

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
# Tags are intentional user labels, so a shared tag is a stronger signal than a
# shared name token - allow a larger group before treating it as noise.
_MAX_TAG_GROUP = 50
# Cap the description snippet carried in a node's meta (keeps graph.json compact).
_META_DESC_CHARS = 280
# Cap how many of a table's rows become graph nodes (keeps a huge table from
# exploding the graph); truncation is logged, never silent.
_MAX_ROWS_PER_TABLE = 500

log = logging.getLogger("graph.build")


def _row_cells(fields, data: dict) -> dict:
    """A compact, name-keyed preview of a row's non-empty cells for node meta -
    so the graph reads as records (field name -> value), not opaque field ids."""
    out = {}
    for f in fields[:8]:
        val = (data or {}).get(str(f.id))
        if val in (None, "", []):
            continue
        if f.type == "single_select":
            val = next((c.get("name") for c in f.options.get("choices", []) if c.get("id") == val), val)
        out[f.name] = str(val)[:80]
    return out
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


def _file_meta(fi) -> dict:
    """Node metadata for a file, carried verbatim into graph.json / the API / MCP.

    Includes the user-authored description + tags and any extracted media
    metadata, but only keys that actually have a value - so the graph stays
    compact and an AI reading it sees real context, not empty fields.
    """
    meta = {
        "file_id": str(fi.id),
        "kind": fi.kind,
        "size_bytes": fi.size_bytes,
        "folder_id": str(fi.folder_id) if fi.folder_id else None,
    }
    if fi.description:
        meta["description"] = fi.description[:_META_DESC_CHARS]
    if fi.tags:
        meta["tags"] = list(fi.tags)
    if fi.width and fi.height:
        meta["width"] = fi.width
        meta["height"] = fi.height
    if fi.duration_seconds:
        meta["duration_seconds"] = fi.duration_seconds
    return meta


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
            meta=_file_meta(fi),
        )
        file_node[fi.id] = n
        nodes.append(n)

    # Tables + their rows become nodes too, so structured data shows up in the
    # graph alongside files. Rows carry a readable, name-keyed preview of their
    # cells so an AI reading the graph sees the record, not opaque ids.
    from apps.tables.models import Field as TField, Row as TRow, Table as TTable

    tables = list(TTable.objects.filter(owner=user, deleted_at__isnull=True))
    fields_by_table: dict = {}
    for tf in TField.objects.filter(table__in=tables):
        fields_by_table.setdefault(tf.table_id, []).append(tf)
    table_node = {}          # table_id -> GraphNode
    row_node: dict = {}      # row_id -> (GraphNode, table_id)
    for tb in tables:
        tfields = sorted(fields_by_table.get(tb.id, []), key=lambda f: f.position)
        primary = next((f for f in tfields if f.is_primary), None)
        tnode = GraphNode(
            owner=user, kind=NodeKind.TABLE, label=tb.name, node_type="table",
            scope_folder_id=tb.folder_id,
            meta={"table_id": str(tb.id), "folder_id": str(tb.folder_id) if tb.folder_id else None,
                  "fields": [f.name for f in tfields]},
        )
        table_node[tb.id] = tnode
        nodes.append(tnode)
        rows = list(TRow.objects.filter(table=tb).order_by("position", "created_at"))
        if len(rows) > _MAX_ROWS_PER_TABLE:
            log.warning("graph: table %s has %d rows; only %d added as nodes",
                        tb.id, len(rows), _MAX_ROWS_PER_TABLE)
            rows = rows[:_MAX_ROWS_PER_TABLE]
        for i, row in enumerate(rows):
            label = ""
            if primary:
                label = str(row.data.get(str(primary.id)) or "").strip()[:120]
            label = label or f"Row {i + 1}"
            rnode = GraphNode(
                owner=user, kind=NodeKind.ROW, label=label, node_type="row",
                scope_folder_id=tb.folder_id,
                meta={"row_id": str(row.id), "table_id": str(tb.id),
                      "cells": _row_cells(tfields, row.data)},
            )
            row_node[row.id] = (rnode, tb.id)
            nodes.append(rnode)

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
    # CONTAINS: folder -> table, and table -> its rows.
    for tb in tables:
        if tb.folder_id in folder_node:
            _add(folder_node[tb.folder_id], table_node[tb.id],
                 GraphEdge.Rel.CONTAINS, Provenance.EXTRACTED, "folder contains table")
    for _rid, (rnode, tbid) in row_node.items():
        _add(table_node[tbid], rnode, GraphEdge.Rel.CONTAINS, Provenance.EXTRACTED, "table contains row")

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

    # SHARED_TAG: files that share a user-applied tag. Unlike name tokens these
    # link across the whole tree (a tag is a deliberate cross-folder label), and
    # connect as a star from the group's first file to keep edge count linear.
    tag_groups: dict[str, list] = {}
    for fi in files:
        for tag in (fi.tags or []):
            key = str(tag).strip().lower()
            if key:
                tag_groups.setdefault(key, []).append(fi)
    for tag, members in tag_groups.items():
        if not (2 <= len(members) <= _MAX_TAG_GROUP):
            continue
        hub = file_node[members[0].id]
        for other in members[1:]:
            _add(hub, file_node[other.id], GraphEdge.Rel.SHARED_TAG,
                 Provenance.INFERRED, f'both tagged "{tag}"')

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
        # A document is scanned in full (indexed text, or a bounded blob read);
        # any file's user-authored description is scanned too, so a description
        # that names another file links them - regardless of kind.
        body = ""
        if src.kind == File.Kind.DOC:
            body = src.content_text or ""
            if not body and src.storage_object_id and storage is not None:
                obj = src.storage_object
                if obj and (obj.size_bytes or 0) <= _MAX_SCAN_BYTES:
                    try:
                        body = storage.read_bytes(region=obj.region, object_key=obj.object_key).decode("utf-8", "ignore")
                    except Exception:  # noqa: BLE001 - a missing/unreadable blob is fine
                        body = ""
        text = "\n".join(p for p in (src.description or "", body) if p)
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
    """A *local* storage backend whose blobs sit on this box, else None.

    The un-indexed-doc fallback below reads a blob to scan it for references. We
    gate that on ``local_path`` (present only on the local/self-host backend) so
    a rebuild never fans out into remote R2 GETs - REFERENCES scanning is simply
    skipped for R2-backed stores, where indexed ``content_text`` still covers the
    common case."""
    try:
        from apps.storage.services.base import get_storage_service
        storage = get_storage_service()
    except Exception:  # noqa: BLE001
        return None
    return storage if hasattr(storage, "local_path") else None


# A first-ever graph build up to this many nodes is done inline (instant first
# view); a larger store builds in the background so the read can't time out.
_INLINE_FIRST_BUILD_MAX = 500

_rebuilding: set = set()  # user ids with a background rebuild already in flight
_rebuild_lock = threading.Lock()


def _rebuild_in_background(user) -> None:
    """Recompute the graph on a daemon thread; de-duplicated per user."""
    uid = user.pk
    with _rebuild_lock:
        if uid in _rebuilding:
            return
        _rebuilding.add(uid)

    def _run():
        from django.db import connection

        try:
            rebuild_user_graph(user)
        except Exception:  # noqa: BLE001 - never crash the background thread
            logging.getLogger("graph").exception("graph rebuild failed for user %s", uid)
        finally:
            with _rebuild_lock:
                _rebuilding.discard(uid)
            connection.close()  # don't leak this thread's DB connection

    threading.Thread(target=_run, name=f"graph-rebuild-{uid}", daemon=True).start()


def ensure_fresh(user) -> None:
    """Rebuild the graph if it's missing or stale.

    Stale = a file/folder changed after the last build. In the single-container
    standalone deployment the recompute would otherwise run INLINE in the graph
    GET and, for a large store, blow past gunicorn's request timeout. So there we
    rebuild on a background thread and serve the currently-stored graph (reads
    become eventually-consistent, refreshing within a moment). The very first
    build for a small store still runs inline so the first view is populated.
    Elsewhere (tests, real Celery worker) it stays synchronous.
    """
    from django.conf import settings
    from django.db.models import Max

    background = getattr(settings, "STANDALONE", False)
    build = GraphBuild.objects.filter(owner=user).first()
    if build is None or build.built_at is None:
        if background:
            n = File.objects.filter(owner=user).count() + Folder.objects.filter(owner=user).count()
            if n > _INLINE_FIRST_BUILD_MAX:
                _rebuild_in_background(user)
                return
        rebuild_user_graph(user)
        return
    from apps.tables.models import Field as TField, Row as TRow, Table as TTable

    f_latest = File.objects.filter(owner=user).aggregate(m=Max("updated_at"))["m"]
    d_latest = Folder.objects.filter(owner=user).aggregate(m=Max("updated_at"))["m"]
    # Table/row/field edits must invalidate the graph too, so a metadata change
    # from the UI, API, or MCP shows up on the next graph read.
    t_latest = TTable.objects.filter(owner=user).aggregate(m=Max("updated_at"))["m"]
    r_latest = TRow.objects.filter(table__owner=user).aggregate(m=Max("updated_at"))["m"]
    fl_latest = TField.objects.filter(table__owner=user).aggregate(m=Max("updated_at"))["m"]
    latest = max([t for t in (f_latest, d_latest, t_latest, r_latest, fl_latest) if t is not None], default=None)
    if latest is not None and latest > build.built_at:
        if background:
            _rebuild_in_background(user)  # serve the current graph; refresh behind the scenes
        else:
            rebuild_user_graph(user)

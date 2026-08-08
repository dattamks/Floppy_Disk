"""
Scoped reads over the knowledge graph.

Every function here funnels through apps.storage.scoping.scoped_folder_ids, the
same chokepoint the file store uses - so a folder-scoped API key sees only the
nodes inside its subtree, and an edge only when BOTH endpoints are visible
(cross-scope edges are clipped). Session users and full-access keys are
unrestricted. This is why folder-scoping "just works" for the graph.
"""
from __future__ import annotations

import re

from django.db.models import Q

from apps.storage.scoping import scope_files, scoped_folder_ids

from .models import GraphEdge, GraphNode


def scoped_nodes(user, request):
    qs = GraphNode.objects.filter(owner=user)
    ids = scoped_folder_ids(request)
    if ids is not None:
        qs = qs.filter(scope_folder_id__in=ids)
    return qs


def scoped_edges(user, request):
    ids = scoped_folder_ids(request)
    qs = GraphEdge.objects.filter(owner=user).select_related("source", "target")
    if ids is not None:
        # Clip at the boundary: both endpoints must be inside the scope.
        qs = qs.filter(source__scope_folder_id__in=ids, target__scope_folder_id__in=ids)
    return qs


def _node_dict(n: GraphNode) -> dict:
    return {
        "id": str(n.id),
        "type": n.node_type,
        "kind": n.kind,
        "label": n.label,
        "file_id": str(n.file_id) if n.file_id else None,
        "folder_id": str(n.folder_id) if n.folder_id else None,
        "meta": n.meta or {},
    }


def _edge_dict(e: GraphEdge) -> dict:
    return {
        "source": str(e.source_id),
        "target": str(e.target_id),
        "rel": e.rel,
        "provenance": e.provenance,
        "reason": e.reason,
    }


def graph_json(user, request) -> dict:
    """A GraphRAG-ready export (Graphify-compatible shape): nodes + explained
    edges, already limited to what this request is allowed to see."""
    nodes = list(scoped_nodes(user, request))
    edges = list(scoped_edges(user, request))
    return {
        "version": "1.0",
        "generator": "floppy-disk",
        "scoped": scoped_folder_ids(request) is not None,
        "nodes": [_node_dict(n) for n in nodes],
        "edges": [_edge_dict(e) for e in edges],
        "counts": {"nodes": len(nodes), "edges": len(edges)},
    }


def graph_search(user, request, query, limit=20):
    """Graph-aware search: name matches (within scope) each returned with their
    immediate neighbors, so an AI gets a match *and* its surrounding context in
    one call. Complements the plain name search; both are scope-filtered."""
    query = (query or "").strip()
    if not query:
        return {"query": "", "results": []}
    # Match the node's name or the file's user-authored description, so the
    # graph considers description too (folder nodes have no file, so the
    # description clause simply never matches them).
    matches = list(
        scoped_nodes(user, request)
        .filter(Q(label__icontains=query) | Q(file__description__icontains=query))[:limit]
    )
    match_ids = [n.id for n in matches]
    # Pull every in-scope edge touching a matched node in one query.
    edges = scoped_edges(user, request).filter(Q(source_id__in=match_ids) | Q(target_id__in=match_ids))
    by_node: dict = {nid: [] for nid in match_ids}
    for e in edges:
        if e.source_id in by_node:
            by_node[e.source_id].append(("out", e, e.target))
        if e.target_id in by_node:
            by_node[e.target_id].append(("in", e, e.source))
    results = []
    for n in matches:
        results.append({
            "node": _node_dict(n),
            "related": [
                {"direction": d, "rel": e.rel, "provenance": e.provenance,
                 "reason": e.reason, "node": _node_dict(other)}
                for (d, e, other) in by_node.get(n.id, [])
            ],
        })
    return {"query": query, "results": results}


def related_to_file(user, request, file_id):
    """Neighbors of a file's node (in scope). Returns None if the file has no
    visible node (unknown, out of scope, or not yet built)."""
    node = scoped_nodes(user, request).filter(file_id=file_id).first()
    if node is None:
        return None
    edges = scoped_edges(user, request).filter(Q(source=node) | Q(target=node))
    neighbors = []
    for e in edges:
        other = e.target if e.source_id == node.id else e.source
        neighbors.append({
            "direction": "out" if e.source_id == node.id else "in",
            "rel": e.rel,
            "provenance": e.provenance,
            "reason": e.reason,
            "node": _node_dict(other),
        })
    return {"node": _node_dict(node), "related": neighbors}


# --- Linked / unlinked mentions (Obsidian-style backlinks with context) -------
#
# Reuses the cached ``content_text`` (populated by search indexing) so we never
# fetch a blob here. Everything is funneled through ``scope_files`` so a
# folder-scoped key only ever sees mentions inside its subtree.
_MENTION_SOURCE_CAP = 400  # most source files to scan (personal scale)
_SNIPPETS_PER_SOURCE = 3
_SNIPPET_RADIUS = 80

_WIKI_MENTION_RE = re.compile(r"\[\[\s*([^\[\]]+?)\s*\]\]")


def _title_of(name: str) -> str:
    return re.sub(r"\.md$", "", name or "", flags=re.IGNORECASE).strip()


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def _snippet(text: str, start: int, end: int) -> dict:
    a = max(0, start - _SNIPPET_RADIUS)
    b = min(len(text), end + _SNIPPET_RADIUS)
    before = _clean(text[a:start])
    after = _clean(text[end:b])
    if a > 0:
        before = "…" + before
    if b < len(text):
        after = after + "…"
    return {"before": before, "match": text[start:end].strip(), "after": after}


def mentions_for_file(user, request, file_id):
    """Notes that mention this one, split into *linked* (they contain a
    ``[[Title]]`` wiki-link) and *unlinked* (they name the title in plain text
    but never link it) - each with in-context snippets. Returns None when the
    file isn't visible to this request."""
    from apps.storage.models import File

    visible = scope_files(File.objects.filter(owner=user, deleted_at__isnull=True), request)
    target = visible.filter(id=file_id).first()
    if target is None:
        return None
    title = _title_of(target.name)
    empty = {"title": title, "linked": [], "unlinked": [], "counts": {"linked": 0, "unlinked": 0}}
    if not title:
        return empty
    title_lc = title.lower()
    # Plain mention: the title bounded by non-word chars (and not a bracket, so
    # a linked [[Title]] never also counts as an unlinked mention).
    plain_re = re.compile(r"(?<![\w\[])" + re.escape(title) + r"(?![\w\]])", re.IGNORECASE)

    # Any file with indexed text can mention this note (notes are Kind.DOC);
    # content_text is only populated for text-bearing files, so the exclude
    # keeps this to real candidates.
    sources = (
        visible.exclude(id=file_id)
        .exclude(content_text="")
        .only("id", "name", "content_text")[:_MENTION_SOURCE_CAP]
    )

    linked, unlinked = [], []
    for src in sources:
        text = src.content_text or ""
        if not text:
            continue
        link_spans = [
            (m.start(), m.end())
            for m in _WIKI_MENTION_RE.finditer(text)
            if re.split(r"[|#]", m.group(1), 1)[0].strip().lower() == title_lc
        ]
        if link_spans:
            linked.append({
                "file_id": str(src.id),
                "name": _title_of(src.name),
                "count": len(link_spans),
                "snippets": [_snippet(text, s, e) for (s, e) in link_spans[:_SNIPPETS_PER_SOURCE]],
            })
            continue
        plain_spans = [(m.start(), m.end()) for m in plain_re.finditer(text)]
        if plain_spans:
            unlinked.append({
                "file_id": str(src.id),
                "name": _title_of(src.name),
                "count": len(plain_spans),
                "snippets": [_snippet(text, s, e) for (s, e) in plain_spans[:_SNIPPETS_PER_SOURCE]],
            })

    linked.sort(key=lambda x: x["name"].lower())
    unlinked.sort(key=lambda x: x["name"].lower())
    return {
        "title": title,
        "linked": linked,
        "unlinked": unlinked,
        "counts": {
            "linked": sum(x["count"] for x in linked),
            "unlinked": sum(x["count"] for x in unlinked),
        },
    }

"""
Scoped reads over the knowledge graph.

Every function here funnels through apps.storage.scoping.scoped_folder_ids, the
same chokepoint the file store uses - so a folder-scoped API key sees only the
nodes inside its subtree, and an edge only when BOTH endpoints are visible
(cross-scope edges are clipped). Session users and full-access keys are
unrestricted. This is why folder-scoping "just works" for the graph.
"""
from __future__ import annotations

from django.db.models import Q

from apps.storage.scoping import scoped_folder_ids

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

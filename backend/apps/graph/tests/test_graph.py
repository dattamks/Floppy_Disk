"""Graph layer: deterministic build, scoped reads, and the folder-scope contract.

The load-bearing assertion is that folder scope covers the graph: a key scoped
to one folder sees only that subtree's nodes, and cross-scope edges are clipped -
the same visible_to() filter as the file store, applied to graph reads.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import ApiKey
from apps.graph.build import rebuild_user_graph
from apps.graph.models import GraphEdge, GraphNode
from apps.storage.models import File, Folder

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="graph@floppy.disk", password="hunter2pass")


def _folder(owner, name, parent=None):
    return Folder.objects.create(owner=owner, name=name, parent=parent)


def _file(owner, name, folder):
    return File.objects.create(owner=owner, name=name, folder=folder,
                               status=File.Status.READY, size_bytes=1)


@pytest.fixture
def tree(user):
    proj = _folder(user, "Projects")
    acme = _folder(user, "Acme", parent=proj)
    fin = _folder(user, "Finance")
    files = {
        "acme_invoice": _file(user, "invoice-acme.pdf", acme),
        "acme_invoice2": _file(user, "invoice-followup.pdf", acme),
        "fin_secret": _file(user, "salaries.xlsx", fin),
    }
    return {"proj": proj, "acme": acme, "fin": fin, "files": files}


def _session(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _bearer(token):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


def _scoped_key(user, folder):
    key, token = ApiKey.create_for(user, name="scoped")
    key.root_folder = folder
    key.save(update_fields=["root_folder"])
    return token


# --- deterministic build ----------------------------------------------------

def test_build_is_deterministic(user, tree):
    a = rebuild_user_graph(user)
    b = rebuild_user_graph(user)
    assert a == b  # same node/edge counts on rebuild
    # a node per folder + per file
    assert GraphNode.objects.filter(owner=user).count() == 3 + 3


def test_contains_and_shared_token_edges(user, tree):
    rebuild_user_graph(user)
    # CONTAINS: Acme folder -> its two files
    acme_node = GraphNode.objects.get(owner=user, folder=tree["acme"])
    contains = GraphEdge.objects.filter(source=acme_node, rel=GraphEdge.Rel.CONTAINS)
    assert contains.count() == 2
    assert all(e.provenance == "extracted" for e in contains)
    # SHARED_TOKEN: the two "invoice-*" files in Acme are linked, INFERRED
    shared = GraphEdge.objects.filter(owner=user, rel=GraphEdge.Rel.SHARED_TOKEN)
    assert shared.count() == 1
    assert shared.first().provenance == "inferred"


# --- REST API ---------------------------------------------------------------

def test_graph_endpoint_returns_nodes_and_edges(user, tree):
    resp = _session(user).get("/api/v1/graph/")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["counts"]["nodes"] == 6
    assert body["scoped"] is False
    assert {n["label"] for n in body["nodes"]} >= {"invoice-acme.pdf", "salaries.xlsx"}


def test_graph_refreshes_when_a_file_is_added(user, tree):
    c = _session(user)
    first = c.get("/api/v1/graph/").json()["counts"]["nodes"]
    _file(user, "new-note.txt", tree["acme"])
    second = c.get("/api/v1/graph/").json()["counts"]["nodes"]
    assert second == first + 1  # lazy rebuild picked up the new file


def test_related_endpoint(user, tree):
    c = _session(user)
    c.get("/api/v1/graph/")  # build
    fid = tree["files"]["acme_invoice"].id
    body = c.get(f"/api/v1/graph/related/{fid}").json()
    labels = {r["node"]["label"] for r in body["related"]}
    assert "Acme" in labels                      # its containing folder
    assert "invoice-followup.pdf" in labels      # its shared-token sibling


# --- the folder-scope contract (the important part) -------------------------

def test_scoped_key_graph_is_subtree_only(user, tree):
    token = _scoped_key(user, tree["acme"])
    body = _bearer(token).get("/api/v1/graph/").json()
    assert body["scoped"] is True
    labels = {n["label"] for n in body["nodes"]}
    assert "invoice-acme.pdf" in labels
    assert "Acme" in labels
    # nothing from Finance or the ancestor Projects folder
    assert "salaries.xlsx" not in labels
    assert "Finance" not in labels
    assert "Projects" not in labels


def test_scoped_key_edges_clipped_at_boundary(user, tree):
    # A key scoped to the *child* Acme cannot see the "Projects contains Acme"
    # edge, because Projects (the ancestor) is out of its scope.
    token = _scoped_key(user, tree["acme"])
    body = _bearer(token).get("/api/v1/graph/").json()
    node_ids = {n["id"] for n in body["nodes"]}
    for e in body["edges"]:
        assert e["source"] in node_ids and e["target"] in node_ids  # both endpoints visible


def test_scoped_key_related_blocks_out_of_scope_file(user, tree):
    token = _scoped_key(user, tree["acme"])
    out = tree["files"]["fin_secret"].id
    assert _bearer(token).get(f"/api/v1/graph/related/{out}").status_code == 404


def test_scoped_key_cannot_rebuild(user, tree):
    token = _scoped_key(user, tree["acme"])
    assert _bearer(token).post("/api/v1/graph/rebuild").status_code == 403


def test_session_rebuild_ok(user, tree):
    assert _session(user).post("/api/v1/graph/rebuild").status_code == 200


# --- graph-aware search -----------------------------------------------------

def test_graph_search_returns_matches_with_neighbors(user, tree):
    c = _session(user)
    body = c.get("/api/v1/graph/search?q=invoice").json()
    labels = {r["node"]["label"] for r in body["results"]}
    assert "invoice-acme.pdf" in labels
    # the match carries its neighbors (folder + shared-token sibling)
    hit = next(r for r in body["results"] if r["node"]["label"] == "invoice-acme.pdf")
    rel_labels = {r["node"]["label"] for r in hit["related"]}
    assert "Acme" in rel_labels


def test_graph_search_is_scoped(user, tree):
    token = _scoped_key(user, tree["acme"])
    body = _bearer(token).get("/api/v1/graph/search?q=salaries").json()
    assert body["results"] == []  # Finance file is out of scope


# --- content-based REFERENCES edges -----------------------------------------

def _upload(client, name, content: bytes, folder=None):
    payload = {"name": name, "size_bytes": len(content), "kind": "doc"}
    if folder is not None:
        payload["folder"] = str(folder.id)
    init = client.post("/api/v1/storage/uploads", payload, format="json").json()
    fid = init["file"]["id"]
    client.put(init["upload"]["url"], data=content, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{fid}/complete")
    return fid


def test_reference_edge_from_file_content(user):
    from apps.graph.models import GraphEdge, GraphNode

    c = _session(user)
    _upload(c, "target.txt", b"I am the target.")
    src = _upload(c, "index.txt", b"See target.txt for details.")
    rebuild_user_graph(user)

    src_node = GraphNode.objects.get(owner=user, file_id=src)
    refs = GraphEdge.objects.filter(owner=user, source=src_node, rel=GraphEdge.Rel.REFERENCES)
    assert refs.count() == 1
    assert refs.first().target.label == "target.txt"
    assert refs.first().provenance == "extracted"


def test_reference_edge_from_markdown_link(user):
    """A Markdown link [x](budget.json) should create a REFERENCES edge, and a
    link that omits the extension should still resolve by stem."""
    from apps.graph.models import GraphEdge, GraphNode

    c = _session(user)
    _upload(c, "budget.json", b'{"n":1}')
    _upload(c, "roadmap.md", b"# Roadmap")
    src = _upload(c, "readme.md", b"See [the budget](budget.json) and [plan](./roadmap).")
    rebuild_user_graph(user)

    src_node = GraphNode.objects.get(owner=user, file_id=src)
    targets = set(
        GraphEdge.objects.filter(owner=user, source=src_node, rel=GraphEdge.Rel.REFERENCES)
        .values_list("target__label", flat=True)
    )
    assert targets == {"budget.json", "roadmap.md"}


def test_reference_edge_from_wiki_link(user):
    """[[Wiki-links]] (with or without alias/heading) create REFERENCES edges."""
    from apps.graph.models import GraphEdge, GraphNode

    c = _session(user)
    _upload(c, "aurora-spec.md", b"# Spec")
    _upload(c, "budget.md", b"# Budget")
    src = _upload(c, "index.md", b"See [[aurora-spec]] and [[budget|the budget]].")
    rebuild_user_graph(user)

    src_node = GraphNode.objects.get(owner=user, file_id=src)
    targets = set(
        GraphEdge.objects.filter(owner=user, source=src_node, rel=GraphEdge.Rel.REFERENCES)
        .values_list("target__label", flat=True)
    )
    assert targets == {"aurora-spec.md", "budget.md"}


def test_reference_edge_from_escaped_wiki_link(user):
    """A WYSIWYG editor may escape brackets (\\[\\[Note\\]\\]); still resolved."""
    from apps.graph.models import GraphEdge, GraphNode

    c = _session(user)
    _upload(c, "aurora-spec.md", b"# Spec")
    src = _upload(c, "index.md", b"See \\[\\[aurora-spec\\]\\] for details.")
    rebuild_user_graph(user)

    src_node = GraphNode.objects.get(owner=user, file_id=src)
    targets = set(
        GraphEdge.objects.filter(owner=user, source=src_node, rel=GraphEdge.Rel.REFERENCES)
        .values_list("target__label", flat=True)
    )
    assert "aurora-spec.md" in targets


def test_reference_edge_not_duplicated_across_detectors(user):
    """A file named both in a Markdown link and in prose yields ONE edge."""
    from apps.graph.models import GraphEdge, GraphNode

    c = _session(user)
    _upload(c, "budget.json", b'{"n":1}')
    src = _upload(c, "notes.md", b"Track it in [budget](budget.json). Again: budget.json.")
    rebuild_user_graph(user)

    src_node = GraphNode.objects.get(owner=user, file_id=src)
    assert GraphEdge.objects.filter(
        owner=user, source=src_node, rel=GraphEdge.Rel.REFERENCES
    ).count() == 1

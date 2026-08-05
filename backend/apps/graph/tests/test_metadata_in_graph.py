"""File metadata (description + tags) flows into the knowledge graph.

Description and tags are carried in a file node's `meta` (so graph.json / the API
/ MCP all expose them), shared tags create SHARED_TAG edges, a description that
names another file creates a REFERENCES edge, and graph-search matches on
description. Editing metadata marks the graph stale so the next read rebuilds.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.graph.build import rebuild_user_graph
from apps.graph.models import GraphEdge
from apps.storage.models import File

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="meta-graph@floppy.disk", password="hunter2pass")


def _file(owner, name, **kw):
    return File.objects.create(
        owner=owner, name=name, folder=None, status=File.Status.READY, size_bytes=1, **kw
    )


def _node_for(user, file_id):
    from apps.graph.models import GraphNode
    return GraphNode.objects.get(owner=user, file_id=file_id)


# ----------------------------------------------------------------- node meta --
def test_description_and_tags_appear_in_node_meta(user):
    f = _file(user, "budget.xlsx", description="Q3 revenue overview", tags=["finance", "q3"])
    rebuild_user_graph(user)
    meta = _node_for(user, f.id).meta
    assert meta["description"] == "Q3 revenue overview"
    assert meta["tags"] == ["finance", "q3"]


def test_extracted_media_metadata_in_node_meta(user):
    f = _file(user, "poster.png", kind=File.Kind.IMAGE, width=1920, height=1080)
    rebuild_user_graph(user)
    meta = _node_for(user, f.id).meta
    assert meta["width"] == 1920 and meta["height"] == 1080


def test_meta_omits_empty_metadata(user):
    f = _file(user, "plain.txt")
    rebuild_user_graph(user)
    meta = _node_for(user, f.id).meta
    assert "description" not in meta and "tags" not in meta


# ---------------------------------------------------------------- tag edges ---
def test_shared_tag_links_files_across_folders(user):
    a = _file(user, "alpha.txt", tags=["project-x"])
    b = _file(user, "beta.txt", tags=["Project-X"])  # case-insensitive grouping
    _file(user, "gamma.txt", tags=["unrelated"])
    rebuild_user_graph(user)

    na, nb = _node_for(user, a.id), _node_for(user, b.id)
    edge = GraphEdge.objects.filter(
        owner=user, rel=GraphEdge.Rel.SHARED_TAG
    ).filter(source__in=[na, nb], target__in=[na, nb])
    assert edge.exists()
    assert "project-x" in edge.first().reason


def test_no_tag_edge_for_a_lone_tag(user):
    _file(user, "solo.txt", tags=["singleton"])
    rebuild_user_graph(user)
    assert not GraphEdge.objects.filter(owner=user, rel=GraphEdge.Rel.SHARED_TAG).exists()


# ---------------------------------------------------- description references ---
def test_description_naming_another_file_creates_reference(user):
    target = _file(user, "roadmap.md")
    src = _file(user, "photo.png", kind=File.Kind.IMAGE,
                description="Screenshot supporting roadmap.md")
    rebuild_user_graph(user)
    ns, nt = _node_for(user, src.id), _node_for(user, target.id)
    assert GraphEdge.objects.filter(
        owner=user, rel=GraphEdge.Rel.REFERENCES, source=ns, target=nt
    ).exists()


# ------------------------------------------------------------- API / freshness -
def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_graph_api_reflects_a_metadata_edit(user):
    """A PATCH to description marks the graph stale; the next read rebuilds."""
    f = _file(user, "notes.txt")
    c = _client(user)

    # First read builds the graph with no description on the node.
    first = c.get("/api/v1/graph/").json()
    node = next(n for n in first["nodes"] if n.get("file_id") == str(f.id))
    assert "description" not in node["meta"]

    # Edit the description via the API (same path the UI and MCP use).
    r = c.patch(f"/api/v1/storage/files/{f.id}", {"description": "meeting minutes"}, format="json")
    assert r.status_code == 200, r.content

    # The next graph read is rebuilt (file.updated_at > built_at) and carries it.
    second = c.get("/api/v1/graph/").json()
    node2 = next(n for n in second["nodes"] if n.get("file_id") == str(f.id))
    assert node2["meta"]["description"] == "meeting minutes"


def test_graph_search_matches_description(user):
    f = _file(user, "opaque.bin", description="annual budget planning deck")
    rebuild_user_graph(user)
    c = _client(user)
    res = c.get("/api/v1/graph/search", {"q": "budget"}).json()
    assert any(r["node"].get("file_id") == str(f.id) for r in res["results"])

"""Tables and their rows flow into the knowledge graph as nodes + CONTAINS edges."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import ApiKey
from apps.graph.build import rebuild_user_graph
from apps.graph.models import GraphEdge, GraphNode, NodeKind
from apps.storage.models import Folder
from apps.tables.logic import provision_default_table
from apps.tables.models import Row, Table

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="tbl-graph@floppy.disk", password="hunter2pass")


def _table(user, name="Roadmap", folder=None):
    t = Table.objects.create(owner=user, name=name, folder=folder)
    provision_default_table(t)
    return t


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_table_and_rows_become_nodes(user):
    t = _table(user)
    rebuild_user_graph(user)
    tnode = GraphNode.objects.get(owner=user, kind=NodeKind.TABLE)
    assert tnode.label == "Roadmap"
    assert tnode.meta["table_id"] == str(t.id)
    assert "Name" in tnode.meta["fields"]
    # The 3 starter rows are row-nodes contained by the table.
    rows = GraphNode.objects.filter(owner=user, kind=NodeKind.ROW)
    assert rows.count() == 3
    for rn in rows:
        assert GraphEdge.objects.filter(source=tnode, target=rn, rel=GraphEdge.Rel.CONTAINS).exists()


def test_row_label_and_cells_use_field_values(user):
    t = _table(user)
    fields = list(t.fields.all())
    name_f = next(f for f in fields if f.name == "Name")
    status_f = next(f for f in fields if f.name == "Status")
    choice = status_f.options["choices"][0]  # {"id","name":"Todo",...}
    row = t.rows.first()
    row.data = {str(name_f.id): "Ship v1", str(status_f.id): choice["id"]}
    row.save()

    rebuild_user_graph(user)
    rn = GraphNode.objects.get(owner=user, kind=NodeKind.ROW, meta__row_id=str(row.id))
    assert rn.label == "Ship v1"                      # primary field drives the label
    assert rn.meta["cells"]["Name"] == "Ship v1"
    assert rn.meta["cells"]["Status"] == choice["name"]  # select resolved to its name


def test_folder_contains_table_edge(user):
    fo = Folder.objects.create(owner=user, name="Work")
    t = _table(user, "Tasks", folder=fo)
    rebuild_user_graph(user)
    fnode = GraphNode.objects.get(owner=user, kind=NodeKind.FOLDER, folder=fo)
    tnode = GraphNode.objects.get(owner=user, kind=NodeKind.TABLE, meta__table_id=str(t.id))
    assert GraphEdge.objects.filter(source=fnode, target=tnode, rel=GraphEdge.Rel.CONTAINS).exists()


def test_graph_api_reflects_a_table_edit(user):
    """Editing a row invalidates the graph so the next read rebuilds with it."""
    t = _table(user, "CRM")
    c = _client(user)
    first = c.get("/api/v1/graph/").json()
    assert any(n["type"] == "table" and n["label"] == "CRM" for n in first["nodes"])

    # Rename a row's primary cell via the API, then re-read the graph.
    name_f = next(f for f in t.fields.all() if f.is_primary)
    row = t.rows.first()
    r = c.patch(f"/api/v1/tables/rows/{row.id}", {"data": {str(name_f.id): "Acme deal"}}, format="json")
    assert r.status_code == 200, r.content

    second = c.get("/api/v1/graph/").json()
    assert any(n["type"] == "row" and n["label"] == "Acme deal" for n in second["nodes"])


def test_folder_scoped_key_sees_only_its_tables_in_graph(user):
    inside = Folder.objects.create(owner=user, name="Inside")
    outside = Folder.objects.create(owner=user, name="Outside")
    _table(user, "In", folder=inside)
    _table(user, "Out", folder=outside)
    rebuild_user_graph(user)

    key, token = ApiKey.create_for(user, name="scoped", scopes="read,write")
    key.root_folder = inside
    key.save(update_fields=["root_folder"])
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    labels = {n["label"] for n in c.get("/api/v1/graph/").json()["nodes"] if n["type"] == "table"}
    assert "In" in labels and "Out" not in labels

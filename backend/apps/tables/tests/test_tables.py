"""Tables API: schema, rows, cell coercion, trash, and folder scoping."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import ApiKey
from apps.storage.models import Folder
from apps.tables.models import Field, Row, Table

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="tbl@floppy.disk", password="hunter2pass")


def _session(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _bearer(token):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


def _new_table(client, name="Roadmap", folder=None):
    body = {"name": name}
    if folder is not None:
        body["folder"] = str(folder)
    r = client.post("/api/v1/tables/", body, format="json")
    assert r.status_code == 201, r.content
    return r.json()


# ------------------------------------------------------------- provisioning --
def test_create_table_provisions_starter_schema(user):
    c = _session(user)
    t = _new_table(c)
    names = [f["name"] for f in t["fields"]]
    assert names[:3] == ["Name", "Notes", "Status"]
    assert t["fields"][0]["is_primary"] is True
    assert any(v["kind"] == "grid" for v in t["views"])
    # A few empty rows so the grid isn't blank.
    rows = c.get(f"/api/v1/tables/{t['id']}/rows").json()
    assert len(rows) == 3


def test_list_tables_returns_row_count(user):
    c = _session(user)
    _new_table(c, "A")
    _new_table(c, "B")
    rows = c.get("/api/v1/tables/").json()
    assert {r["name"] for r in rows} == {"A", "B"}
    assert all("row_count" in r for r in rows)


# ------------------------------------------------------------------ fields ---
def test_add_and_delete_field_but_not_primary(user):
    c = _session(user)
    t = _new_table(c)
    r = c.post(f"/api/v1/tables/{t['id']}/fields", {"name": "Priority", "type": "number"}, format="json")
    assert r.status_code == 201, r.content
    fid = r.json()["id"]
    assert c.delete(f"/api/v1/tables/fields/{fid}").status_code == 204

    primary = t["fields"][0]["id"]
    assert c.delete(f"/api/v1/tables/fields/{primary}").status_code == 400  # primary protected


def test_unknown_field_type_rejected(user):
    c = _session(user)
    t = _new_table(c)
    r = c.post(f"/api/v1/tables/{t['id']}/fields", {"name": "X", "type": "rocket"}, format="json")
    assert r.status_code == 400


# -------------------------------------------------------------------- rows ---
def test_row_cell_edit_coerces_by_type(user):
    c = _session(user)
    t = _new_table(c)
    name_f = t["fields"][0]["id"]
    num_r = c.post(f"/api/v1/tables/{t['id']}/fields", {"name": "N", "type": "number"}, format="json").json()
    chk_r = c.post(f"/api/v1/tables/{t['id']}/fields", {"name": "Done", "type": "checkbox"}, format="json").json()

    row = c.post(f"/api/v1/tables/{t['id']}/rows", {"data": {}}, format="json").json()
    r = c.patch(f"/api/v1/tables/rows/{row['id']}", {"data": {
        name_f: "Launch", num_r["id"]: "42", chk_r["id"]: True,
    }}, format="json")
    assert r.status_code == 200, r.content
    d = r.json()["data"]
    assert d[name_f] == "Launch"
    assert d[num_r["id"]] == 42          # numeric string -> int
    assert d[chk_r["id"]] is True

    # Clearing a cell (empty value) removes the key.
    d2 = c.patch(f"/api/v1/tables/rows/{row['id']}", {"data": {num_r["id"]: ""}}, format="json").json()["data"]
    assert num_r["id"] not in d2


def test_single_select_only_accepts_valid_choice(user):
    c = _session(user)
    t = _new_table(c)
    status_f = next(f for f in t["fields"] if f["name"] == "Status")
    choice = status_f["options"]["choices"][0]["id"]
    row = c.post(f"/api/v1/tables/{t['id']}/rows", {"data": {}}, format="json").json()

    good = c.patch(f"/api/v1/tables/rows/{row['id']}", {"data": {status_f["id"]: choice}}, format="json").json()
    assert good["data"][status_f["id"]] == choice
    bad = c.patch(f"/api/v1/tables/rows/{row['id']}", {"data": {status_f["id"]: "nope"}}, format="json").json()
    assert status_f["id"] not in bad["data"]  # invalid choice dropped


def test_delete_row(user):
    c = _session(user)
    t = _new_table(c)
    row = c.post(f"/api/v1/tables/{t['id']}/rows", {"data": {}}, format="json").json()
    assert c.delete(f"/api/v1/tables/rows/{row['id']}").status_code == 204
    assert not Row.objects.filter(pk=row["id"]).exists()


# ------------------------------------------------------------- table lifecycle
def test_rename_trash_and_restore(user):
    c = _session(user)
    t = _new_table(c)
    assert c.patch(f"/api/v1/tables/{t['id']}", {"name": "Renamed"}, format="json").json()["name"] == "Renamed"

    assert c.delete(f"/api/v1/tables/{t['id']}").status_code == 204
    assert c.get(f"/api/v1/tables/{t['id']}").status_code == 404          # trashed -> hidden
    assert t["id"] not in [x["id"] for x in c.get("/api/v1/tables/").json()]
    assert t["id"] in [x["id"] for x in c.get("/api/v1/tables/?trashed=1").json()]

    c.patch(f"/api/v1/tables/{t['id']}", {"restore": True}, format="json")
    assert c.get(f"/api/v1/tables/{t['id']}").status_code == 200          # back


def test_owner_isolation(user):
    other = User.objects.create_user(email="other@floppy.disk", password="hunter2pass")
    t = _new_table(_session(user))
    assert _session(other).get(f"/api/v1/tables/{t['id']}").status_code == 404


# --------------------------------------------------------------- folder scope
def test_folder_scoped_key_confined_to_subtree(user):
    inside = Folder.objects.create(owner=user, name="Inside")
    outside = Folder.objects.create(owner=user, name="Outside")
    sess = _session(user)
    t_in = _new_table(sess, "In", folder=inside.id)
    t_out = _new_table(sess, "Out", folder=outside.id)

    key, token = ApiKey.create_for(user, name="scoped", scopes="read,write")
    key.root_folder = inside
    key.save(update_fields=["root_folder"])
    scoped = _bearer(token)

    listed = [x["id"] for x in scoped.get("/api/v1/tables/").json()]
    assert t_in["id"] in listed and t_out["id"] not in listed
    assert scoped.get(f"/api/v1/tables/{t_out['id']}").status_code == 404   # out of scope
    assert scoped.get(f"/api/v1/tables/{t_in['id']}").status_code == 200

    # A scoped key can't create a table at the storage root (folder=None).
    assert scoped.post("/api/v1/tables/", {"name": "Root"}, format="json").status_code == 400


def test_api_key_can_drive_a_table(user):
    """A Bearer key (what MCP uses) can create a table and add/edit rows."""
    key, token = ApiKey.create_for(user, name="full", scopes="read,write")
    c = _bearer(token)
    t = _new_table(c)
    name_f = t["fields"][0]["id"]
    row = c.post(f"/api/v1/tables/{t['id']}/rows", {"data": {name_f: "Via key"}}, format="json").json()
    assert row["data"][name_f] == "Via key"
    assert Table.objects.filter(owner=user).count() == 1

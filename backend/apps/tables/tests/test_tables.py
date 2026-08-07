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


def test_single_field_patch_preserves_other_cells(user):
    # A per-field PATCH must merge onto existing data, not replace the row - so
    # editing one cell never drops another (the property the row lock protects
    # when two such patches land concurrently, e.g. from the row-detail modal).
    c = _session(user)
    t = _new_table(c)
    name_f = t["fields"][0]["id"]
    num_f = c.post(f"/api/v1/tables/{t['id']}/fields", {"name": "N", "type": "number"}, format="json").json()

    row = c.post(f"/api/v1/tables/{t['id']}/rows", {"data": {name_f: "Alpha"}}, format="json").json()
    # Patch only the number cell; the name must survive.
    d = c.patch(f"/api/v1/tables/rows/{row['id']}", {"data": {num_f["id"]: "7"}}, format="json").json()["data"]
    assert d[name_f] == "Alpha"
    assert d[num_f["id"]] == 7
    # And patching only the name back leaves the number intact.
    d2 = c.patch(f"/api/v1/tables/rows/{row['id']}", {"data": {name_f: "Beta"}}, format="json").json()["data"]
    assert d2[name_f] == "Beta"
    assert d2[num_f["id"]] == 7


def test_new_field_types_coerce_values(user):
    c = _session(user)
    t = _new_table(c)
    tid = t["id"]

    def add(name, ftype, options=None):
        body = {"name": name, "type": ftype}
        if options:
            body["options"] = options
        return c.post(f"/api/v1/tables/{tid}/fields", body, format="json").json()

    num = add("Price", "currency", {"symbol": "$"})
    pct = add("Progress", "percent")
    rate = add("Stars", "rating", {"max": 5})
    url = add("Site", "url")
    email = add("Contact", "email")
    ms = add("Tags", "multi_select", {"choices": [
        {"id": "a", "name": "A"}, {"id": "b", "name": "B"}, {"id": "c", "name": "C"},
    ]})

    row = c.post(f"/api/v1/tables/{tid}/rows", {"data": {}}, format="json").json()
    resp = c.patch(f"/api/v1/tables/rows/{row['id']}", {"data": {
        num["id"]: "1200.50", pct["id"]: "80", rate["id"]: "9",  # rating over max -> clamped
        url["id"]: "https://x.io", email["id"]: "a@b.com",
        ms["id"]: ["a", "c", "zzz", "a"],                        # invalid + dup dropped
    }}, format="json")
    d = resp.json()["data"]
    assert d[num["id"]] == 1200.5
    assert d[pct["id"]] == 80
    assert d[rate["id"]] == 5                                    # clamped to max
    assert d[url["id"]] == "https://x.io"
    assert d[email["id"]] == "a@b.com"
    assert d[ms["id"]] == ["a", "c"]                             # valid, de-duped, ordered


def test_attachment_only_accepts_owner_files(user):
    from apps.storage.models import File
    mine = File.objects.create(owner=user, name="spec.pdf", status=File.Status.READY, size_bytes=1)
    other = User.objects.create_user(email="att-other@floppy.disk", password="hunter2pass")
    theirs = File.objects.create(owner=other, name="theirs.pdf", status=File.Status.READY, size_bytes=1)

    c = _session(user)
    t = _new_table(c)
    att = c.post(f"/api/v1/tables/{t['id']}/fields", {"name": "Files", "type": "attachment"}, format="json").json()
    row = c.post(f"/api/v1/tables/{t['id']}/rows", {"data": {}}, format="json").json()
    resp = c.patch(f"/api/v1/tables/rows/{row['id']}", {"data": {
        att["id"]: [str(mine.id), str(theirs.id), "not-a-uuid"],
    }}, format="json")
    # Only the caller's own file survives; a foreign id and junk are dropped.
    assert resp.json()["data"][att["id"]] == [str(mine.id)]


def test_relation_only_accepts_target_table_rows(user):
    c = _session(user)
    ta = _new_table(c, "A")
    tb = _new_table(c, "B")
    b0 = c.get(f"/api/v1/tables/{tb['id']}/rows").json()[0]["id"]
    a0 = c.get(f"/api/v1/tables/{ta['id']}/rows").json()[0]["id"]
    rel = c.post(f"/api/v1/tables/{ta['id']}/fields",
                 {"name": "Links", "type": "relation", "options": {"table_id": tb["id"]}},
                 format="json").json()
    resp = c.patch(f"/api/v1/tables/rows/{a0}", {"data": {
        rel["id"]: [b0, a0, "junk"],   # a0 is in table A (wrong target); junk is not a uuid
    }}, format="json")
    assert resp.json()["data"][rel["id"]] == [b0]


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


def test_bulk_delete_rows(user):
    c = _session(user)
    t = _new_table(c)
    rows = c.get(f"/api/v1/tables/{t['id']}/rows").json()  # 3 starter rows
    ids = [rows[0]["id"], rows[1]["id"]]
    r = c.post(f"/api/v1/tables/{t['id']}/rows/bulk_delete", {"ids": ids}, format="json")
    assert r.status_code == 200 and r.json()["deleted"] == 2
    assert Row.objects.filter(table_id=t["id"]).count() == 1


def test_malformed_row_payloads_are_handled_gracefully(user):
    # The API is a public surface (Bearer keys), so junk payloads must degrade to
    # a clean response, never a 500.
    c = _session(user)
    t = _new_table(c)

    # create_row with a non-dict `data` -> empty row, not a crash.
    r = c.post(f"/api/v1/tables/{t['id']}/rows", {"data": ["not", "a", "dict"]}, format="json")
    assert r.status_code == 201 and r.json()["data"] == {}
    row_id = r.json()["id"]

    # patch a row with a non-dict `data` -> no change, not a crash.
    r = c.patch(f"/api/v1/tables/rows/{row_id}", {"data": "nope"}, format="json")
    assert r.status_code == 200 and r.json()["data"] == {}

    # bulk_delete with malformed ids -> 0 deleted, not a crash.
    r = c.post(f"/api/v1/tables/{t['id']}/rows/bulk_delete", {"ids": ["not-a-uuid", 123, None]}, format="json")
    assert r.status_code == 200 and r.json()["deleted"] == 0


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

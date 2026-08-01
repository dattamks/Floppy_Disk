"""TDD spec for folder-scoped API keys (least-privilege by location).

A key with no root_folder = full account access (unchanged, back-compat).
A key with a root_folder = restricted to that folder's subtree - for reads
(list/detail/download/search) AND writes (create/move/delete). This is the
mechanism that lets an owner hand a specific LLM access to just one folder.
Graph reads reuse the same scope filter (asserted in the graph test suite).
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import ApiKey
from apps.storage.models import File, Folder

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="scope@floppy.disk", password="hunter2pass")


def _session(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _bearer(token):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


def _mk_folder(owner, name, parent=None):
    return Folder.objects.create(owner=owner, name=name, parent=parent)


def _mk_file(owner, name, folder):
    return File.objects.create(
        owner=owner, name=name, folder=folder, status=File.Status.READY, size_bytes=1,
    )


@pytest.fixture
def tree(user):
    """
        Projects/            (proj)
          Acme/              (acme)   <- scope root
            specs/           (specs)
        Finance/             (fin)
    """
    proj = _mk_folder(user, "Projects")
    acme = _mk_folder(user, "Acme", parent=proj)
    specs = _mk_folder(user, "specs", parent=acme)
    fin = _mk_folder(user, "Finance")
    files = {
        "acme_note": _mk_file(user, "acme-note.txt", acme),
        "spec_doc": _mk_file(user, "spec.txt", specs),
        "fin_secret": _mk_file(user, "salaries.txt", fin),
        "proj_readme": _mk_file(user, "readme.txt", proj),
    }
    return {"proj": proj, "acme": acme, "specs": specs, "fin": fin, "files": files}


def _scoped_key(user, folder):
    key, token = ApiKey.create_for(user, name="scoped", scopes="read,write")
    key.root_folder = folder
    key.save(update_fields=["root_folder"])
    return token


# --- model / back-compat ----------------------------------------------------

def test_key_defaults_to_unscoped(user):
    key, _ = ApiKey.create_for(user, name="full")
    assert key.root_folder_id is None  # no folder = full access


# --- reads: listing ---------------------------------------------------------

def test_scoped_key_lists_only_subtree_files(user, tree):
    token = _scoped_key(user, tree["acme"])
    c = _bearer(token)
    # inside scope: acme's own files
    ids = {f["id"] for f in c.get(f"/api/v1/storage/files?folder={tree['acme'].id}").json()}
    assert str(tree["files"]["acme_note"].id) in ids
    # a descendant folder is reachable
    spec_ids = {f["id"] for f in c.get(f"/api/v1/storage/files?folder={tree['specs'].id}").json()}
    assert str(tree["files"]["spec_doc"].id) in spec_ids
    # out of scope: Finance is invisible even by explicit id
    fin = c.get(f"/api/v1/storage/files?folder={tree['fin'].id}").json()
    assert fin == []


def test_scoped_key_lists_only_subtree_folders(user, tree):
    token = _scoped_key(user, tree["acme"])
    c = _bearer(token)
    # listing children of acme shows specs
    kids = {f["id"] for f in c.get(f"/api/v1/storage/folders?parent={tree['acme'].id}").json()}
    assert str(tree["specs"].id) in kids
    # cannot list Projects' children (Projects is an ancestor, out of scope)
    proj_kids = {f["id"] for f in c.get(f"/api/v1/storage/folders?parent={tree['proj'].id}").json()}
    assert str(tree["acme"].id) not in proj_kids


# --- reads: detail / download ----------------------------------------------

def test_scoped_key_download_in_scope_ok_out_of_scope_404(user, tree):
    token = _scoped_key(user, tree["acme"])
    c = _bearer(token)
    # storage_object required for a real download URL; stub one in for the in-scope file
    from apps.storage.models import StorageObject
    obj = StorageObject.objects.create(
        content_hash="a" * 64, region=user.storage_region, size_bytes=1,
        status=StorageObject.Status.READY, object_key=f"{user.id}/x",
    )
    f = tree["files"]["acme_note"]
    f.storage_object = obj
    f.save(update_fields=["storage_object"])
    assert c.get(f"/api/v1/storage/files/{f.id}/download").status_code == 200
    # out of scope file -> 404, even though it belongs to the same owner
    out = tree["files"]["fin_secret"]
    assert c.get(f"/api/v1/storage/files/{out.id}/download").status_code == 404


def test_scoped_key_cannot_rename_out_of_scope_file(user, tree):
    token = _scoped_key(user, tree["acme"])
    c = _bearer(token)
    out = tree["files"]["fin_secret"]
    assert c.patch(f"/api/v1/storage/files/{out.id}", {"name": "hacked.txt"}, format="json").status_code == 404
    out.refresh_from_db()
    assert out.name == "salaries.txt"


# --- reads: search ----------------------------------------------------------

def test_scoped_key_search_is_subtree_only(user, tree):
    token = _scoped_key(user, tree["acme"])
    c = _bearer(token)
    # a term that matches files in and out of scope
    names = {r["name"] for r in c.get("/api/v1/storage/search?q=.txt").json()["results"]}
    assert "acme-note.txt" in names
    assert "spec.txt" in names
    assert "salaries.txt" not in names   # Finance is out of scope
    assert "readme.txt" not in names     # Projects (ancestor) is out of scope


# --- writes -----------------------------------------------------------------

def test_scoped_key_cannot_move_file_out_of_scope(user, tree):
    token = _scoped_key(user, tree["acme"])
    c = _bearer(token)
    f = tree["files"]["acme_note"]
    # moving to Finance (out of scope) is rejected
    resp = c.patch(f"/api/v1/storage/files/{f.id}", {"folder": str(tree["fin"].id)}, format="json")
    assert resp.status_code == 400
    f.refresh_from_db()
    assert f.folder_id == tree["acme"].id


def test_scoped_key_create_folder_at_root_rejected(user, tree):
    token = _scoped_key(user, tree["acme"])
    c = _bearer(token)
    # no parent => storage root, which is outside the key's folder
    resp = c.post("/api/v1/storage/folders", {"name": "Loose"}, format="json")
    assert resp.status_code == 400
    # but creating inside the scope works
    ok = c.post("/api/v1/storage/folders",
                {"name": "Sub", "parent": str(tree["acme"].id)}, format="json")
    assert ok.status_code == 201, ok.content


# --- session auth is unaffected --------------------------------------------

def test_session_user_sees_everything(user, tree):
    c = _session(user)
    names = {r["name"] for r in c.get("/api/v1/storage/search?q=.txt").json()["results"]}
    assert "salaries.txt" in names and "readme.txt" in names


def test_unscoped_key_sees_everything(user, tree):
    key, token = ApiKey.create_for(user, name="full")
    names = {r["name"] for r in _bearer(token).get("/api/v1/storage/search?q=.txt").json()["results"]}
    assert "salaries.txt" in names and "readme.txt" in names


# --- key creation API -------------------------------------------------------

def test_create_scoped_key_via_endpoint(user, tree):
    c = _session(user)
    body = c.post("/api/v1/auth/api-keys",
                  {"name": "acme-llm", "root_folder": str(tree["acme"].id)}, format="json").json()
    assert body["root_folder"] == str(tree["acme"].id)
    listing = c.get("/api/v1/auth/api-keys").json()
    assert listing[0]["root_folder"] == str(tree["acme"].id)


def test_cannot_scope_key_to_another_users_folder(user):
    other = User.objects.create_user(email="mallory@floppy.disk", password="hunter2pass")
    their_folder = _mk_folder(other, "Theirs")
    resp = _session(user).post("/api/v1/auth/api-keys",
                               {"name": "x", "root_folder": str(their_folder.id)}, format="json")
    assert resp.status_code == 400

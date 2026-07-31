"""Create-a-note endpoint: POST /storage/notes (one-call Markdown doc)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File, Folder

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="note@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_create_blank_note_defaults_and_kind(client, user):
    r = client.post("/api/v1/storage/notes", {}, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["name"] == "Untitled note.md"
    assert body["kind"] == "doc"
    assert body["status"] == "ready"
    f = File.objects.get(id=body["id"])
    assert f.owner_id == user.id and f.size_bytes == 0


def test_create_note_with_name_and_content_indexes_for_search(client):
    r = client.post("/api/v1/storage/notes",
                    {"name": "Ideas", "content": "# Ideas\nThe Xylophone plan is bold."},
                    format="json")
    assert r.status_code == 201, r.content
    assert r.json()["name"] == "Ideas.md"  # .md appended
    # Content is immediately searchable (full-text).
    s = client.get("/api/v1/storage/search?q=Xylophone")
    names = [x["name"] for x in (s.json().get("results", s.json()))]
    assert "Ideas.md" in names


def test_create_note_in_folder(client, user):
    folder = Folder.objects.create(owner=user, name="Notebook")
    r = client.post("/api/v1/storage/notes", {"name": "Day 1", "folder": str(folder.id)}, format="json")
    assert r.status_code == 201, r.content
    assert File.objects.get(id=r.json()["id"]).folder_id == folder.id


def test_note_name_collision_auto_suffixes(client):
    client.post("/api/v1/storage/notes", {"name": "Journal"}, format="json")
    r2 = client.post("/api/v1/storage/notes", {"name": "Journal"}, format="json")
    assert r2.json()["name"] == "Journal (2).md"


def test_create_note_then_edit_content_roundtrips(client):
    fid = client.post("/api/v1/storage/notes", {"name": "Draft"}, format="json").json()["id"]
    r = client.put(f"/api/v1/storage/files/{fid}/content",
                   {"content": "final Zebracorn text"}, format="json")
    assert r.status_code == 200, r.content
    s = client.get("/api/v1/storage/search?q=Zebracorn")
    assert "Draft.md" in [x["name"] for x in (s.json().get("results", s.json()))]


def test_create_note_requires_auth():
    assert APIClient().post("/api/v1/storage/notes", {}, format="json").status_code == 403


def test_note_respects_folder_scope(client, user):
    from apps.accounts.models import ApiKey

    work = Folder.objects.create(owner=user, name="Work")
    other = Folder.objects.create(owner=user, name="Other")
    key, token = ApiKey.create_for(user, name="scoped", scopes="read,write")
    key.root_folder = work
    key.save(update_fields=["root_folder"])
    scoped = APIClient()
    scoped.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # Inside scope: allowed.
    ok = scoped.post("/api/v1/storage/notes", {"name": "n", "folder": str(work.id)}, format="json")
    assert ok.status_code == 201
    # Outside scope: rejected.
    bad = scoped.post("/api/v1/storage/notes", {"name": "n", "folder": str(other.id)}, format="json")
    assert bad.status_code == 400

"""Full-text (content) search: search matches document text, not just names."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import File

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="fts@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _upload(client, name, content, kind="doc", folder=None):
    body = {"name": name, "size_bytes": len(content), "kind": kind}
    if folder:
        body["folder"] = str(folder)
    init = client.post("/api/v1/storage/uploads", body, format="json")
    assert init.status_code == 201, init.content
    d = init.json()
    client.put(d["upload"]["url"], data=content, content_type="application/octet-stream")
    done = client.post(f"/api/v1/storage/uploads/{d['file']['id']}/complete")
    assert done.status_code == 200, done.content
    return d["file"]["id"]


def _search(client, q):
    r = client.get(f"/api/v1/storage/search?q={q}")
    assert r.status_code == 200, r.content
    data = r.json()
    rows = data.get("results", data) if isinstance(data, dict) else data
    return sorted(x["name"] for x in rows)


def test_content_is_indexed_on_upload(client):
    fid = _upload(client, "meeting.md", b"# Notes\nThe quarterly Xylophone budget was approved.")
    assert File.objects.get(id=fid).content_text.strip() != ""


def test_search_matches_content_not_only_name(client):
    _upload(client, "meeting.md", b"# Notes\nThe quarterly Xylophone budget was approved.")
    _upload(client, "other.md", b"# Other\nnothing relevant here.")
    # 'Xylophone' appears only in the *content* of meeting.md, not any filename.
    assert _search(client, "Xylophone") == ["meeting.md"]


def test_search_still_matches_name(client):
    _upload(client, "budget-2026.md", b"nothing special")
    assert "budget-2026.md" in _search(client, "budget")


def test_media_without_text_is_not_matched_by_content(client):
    # An image file gets no content_text; searching random content finds nothing.
    _upload(client, "photo.png", b"\x89PNG\r\n\x1a\n binaryblob Xylophone", kind="image")
    assert _search(client, "Xylophone") == []


def test_edit_content_reindexes(client):
    fid = _upload(client, "doc.md", b"original content here")
    # Overwrite the content with a new distinctive word.
    r = client.put(f"/api/v1/storage/files/{fid}/content",
                   {"content": "completely new Zebracorn text"}, format="json")
    assert r.status_code == 200, r.content
    assert _search(client, "Zebracorn") == ["doc.md"]
    assert _search(client, "original") == []


def test_content_search_respects_folder_scope(client, user):
    from apps.accounts.models import ApiKey
    from apps.storage.models import Folder

    work = Folder.objects.create(owner=user, name="Work")
    priv = Folder.objects.create(owner=user, name="Private")
    _upload(client, "spec.md", b"the Xylophone spec lives here", folder=work.id)
    _upload(client, "secret.md", b"the Xylophone secret lives here", folder=priv.id)

    key, token = ApiKey.create_for(user, name="scoped", scopes="read,write")
    key.root_folder = work
    key.save(update_fields=["root_folder"])
    scoped = APIClient()
    scoped.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    # The scoped key must only find the in-scope document, never the private one.
    assert _search(scoped, "Xylophone") == ["spec.md"]

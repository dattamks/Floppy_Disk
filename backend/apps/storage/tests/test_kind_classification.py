"""Server-side kind classification for uploads that omit `kind`.

Regression for a gap found in validation: REST/MCP clients that don't set
`kind` had every upload stored as the generic "file", so the knowledge graph
never scanned their documents for cross-references. The server now derives kind
from the filename/content-type when the client leaves it at the default.
"""
import pytest

from apps.storage.models import File
from apps.storage.naming import classify_kind


@pytest.mark.parametrize("name,expected", [
    ("notes.md", "doc"),
    ("budget.json", "doc"),
    ("infra-config.yaml", "doc"),
    ("README", "file"),          # no extension, no hint -> stays generic
    ("photo.png", "image"),
    ("clip.mp4", "video"),
    ("song.mp3", "audio"),
    ("report.pdf", "doc"),
    ("data.csv", "doc"),
])
def test_classify_kind_from_name(name, expected):
    assert classify_kind(name) == expected


def test_content_type_hint_wins_over_extension():
    assert classify_kind("blob", content_type="image/png") == "image"
    assert classify_kind("blob", content_type="text/markdown") == "doc"


@pytest.mark.django_db
def test_upload_without_kind_is_classified(client, django_user_model):
    from django.test import Client
    user = django_user_model.objects.create_user(
        email="k@floppy.disk", password="s3cretpass99", date_of_birth="1990-01-01",
    )
    c = Client()
    c.force_login(user)
    content = b"# Plan\nsee budget.json"
    # No `kind` in the payload — the server must classify it as a document.
    r = c.post("/api/v1/storage/uploads",
               {"name": "plan.md", "size_bytes": len(content)},
               content_type="application/json")
    assert r.status_code == 201, r.content
    fid = r.json()["file"]["id"]
    assert File.objects.get(id=fid).kind == File.Kind.DOC


@pytest.mark.django_db
def test_explicit_kind_is_respected(django_user_model):
    from django.test import Client
    user = django_user_model.objects.create_user(
        email="k2@floppy.disk", password="s3cretpass99", date_of_birth="1990-01-01",
    )
    c = Client()
    c.force_login(user)
    # An explicit non-default kind must never be overridden by derivation.
    r = c.post("/api/v1/storage/uploads",
               {"name": "notes.md", "size_bytes": 5, "kind": "image"},
               content_type="application/json")
    assert r.status_code == 201, r.content
    assert File.objects.get(id=r.json()["file"]["id"]).kind == File.Kind.IMAGE

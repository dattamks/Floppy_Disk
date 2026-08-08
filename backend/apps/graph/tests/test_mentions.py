"""Linked / unlinked mentions endpoint - the data behind a note's backlinks panel.

A source note that writes ``[[Aurora]]`` is a *linked* mention; one that only
names "Aurora" in prose is an *unlinked* mention; each carries a context
snippet. Folder scope is honored via the same scope_files chokepoint the store
uses, so a scoped key never sees mentions from outside its subtree.
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
    return User.objects.create_user(email="mentions@floppy.disk", password="hunter2pass")


def _note(owner, name, folder, body):
    # Notes are indexed as Kind.DOC (that's how their body reaches content_text).
    return File.objects.create(owner=owner, name=name, folder=folder,
                               status=File.Status.READY, size_bytes=len(body),
                               kind=File.Kind.DOC, content_text=body)


def _session(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_linked_and_unlinked_mentions_with_snippets(user):
    folder = Folder.objects.create(owner=user, name="Vault")
    aurora = _note(user, "Aurora.md", folder, "# Aurora\nThe flagship.")
    _note(user, "Index.md", folder, "See [[Aurora]] for the full plan of record.")
    _note(user, "Diary.md", folder, "Today I finally understood what Aurora is really about.")
    _note(user, "Unrelated.md", folder, "Nothing to see here.")

    res = _session(user).get(f"/api/v1/graph/mentions/{aurora.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Aurora"

    linked_names = {m["name"] for m in data["linked"]}
    unlinked_names = {m["name"] for m in data["unlinked"]}
    assert linked_names == {"Index"}
    assert unlinked_names == {"Diary"}
    assert data["counts"]["linked"] == 1
    assert data["counts"]["unlinked"] == 1

    # The linked mention carries an in-context snippet around the [[Aurora]].
    snip = data["linked"][0]["snippets"][0]
    assert snip["match"] == "[[Aurora]]"
    assert "See" in snip["before"]
    assert "plan of record" in snip["after"]

    # A note that both links and mentions counts only as linked (no double-count).
    diary_snip = data["unlinked"][0]["snippets"][0]
    assert diary_snip["match"] == "Aurora"


def test_mentions_are_folder_scoped(user):
    root = Folder.objects.create(owner=user, name="Root")
    inside = Folder.objects.create(owner=user, name="Inside", parent=root)
    outside = Folder.objects.create(owner=user, name="Outside")
    target = _note(user, "Aurora.md", inside, "# Aurora")
    _note(user, "InsideRef.md", inside, "Links to [[Aurora]] here.")
    _note(user, "OutsideRef.md", outside, "Also links to [[Aurora]] here.")

    key, token = ApiKey.create_for(user, name="scoped")
    key.root_folder = inside
    key.save(update_fields=["root_folder"])
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    data = c.get(f"/api/v1/graph/mentions/{target.id}").json()
    assert {m["name"] for m in data["linked"]} == {"InsideRef"}  # OutsideRef clipped

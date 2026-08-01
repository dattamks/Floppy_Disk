"""Graph freshness: keep the recompute off the request path in standalone.

A stale graph must never make a GET /graph rebuild inline - on a large store
that recompute would blow past gunicorn's request timeout and kill the worker.
In the single-container standalone deployment we background the rebuild and
serve the currently-stored graph; everywhere else (tests, a real Celery worker)
it stays synchronous. The very first build for a *small* store still runs inline
so the first view isn't empty.
"""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.graph import build as build_mod
from apps.graph.build import ensure_fresh, rebuild_user_graph
from apps.graph.models import GraphBuild
from apps.storage.models import File, Folder

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(email="fresh@floppy.disk", password="hunter2pass")


def _make_file(user, name="doc.pdf"):
    return File.objects.create(
        owner=user, name=name, status=File.Status.READY, size_bytes=1
    )


def test_small_first_build_runs_inline_even_in_standalone(user, settings):
    """First-ever build of a tiny store is synchronous - first view isn't empty."""
    settings.STANDALONE = True
    _make_file(user)
    assert GraphBuild.objects.filter(owner=user).first() is None

    ensure_fresh(user)

    build = GraphBuild.objects.filter(owner=user).first()
    assert build is not None and build.built_at is not None  # built right away


def test_stale_rebuild_is_backgrounded_in_standalone(user, settings, monkeypatch):
    """A stale graph in standalone defers to a background thread, serving current."""
    settings.STANDALONE = True
    rebuild_user_graph(user)  # seed an initial build
    stale_built_at = GraphBuild.objects.get(owner=user).built_at

    # Make the store look changed after the last build.
    f = _make_file(user)
    File.objects.filter(pk=f.pk).update(updated_at=timezone.now())

    calls = []
    monkeypatch.setattr(build_mod, "_rebuild_in_background", lambda u: calls.append(u.pk))

    ensure_fresh(user)

    # Backgrounded (not recomputed inline): stored build is untouched here.
    assert calls == [user.pk]
    assert GraphBuild.objects.get(owner=user).built_at == stale_built_at


def test_stale_rebuild_is_synchronous_off_standalone(user, settings, monkeypatch):
    """Without STANDALONE (tests / real worker) a stale graph rebuilds inline."""
    settings.STANDALONE = False
    rebuild_user_graph(user)
    first_built_at = GraphBuild.objects.get(owner=user).built_at

    f = _make_file(user)
    File.objects.filter(pk=f.pk).update(updated_at=timezone.now())

    monkeypatch.setattr(
        build_mod, "_rebuild_in_background",
        lambda u: pytest.fail("must not background off-standalone"),
    )

    ensure_fresh(user)
    # Rebuilt inline -> build timestamp advanced.
    assert GraphBuild.objects.get(owner=user).built_at >= first_built_at


def test_large_first_build_is_backgrounded_in_standalone(user, settings, monkeypatch):
    """A first build over the inline cap defers so the first read can't time out."""
    settings.STANDALONE = True
    monkeypatch.setattr(build_mod, "_INLINE_FIRST_BUILD_MAX", 2)
    for i in range(4):
        Folder.objects.create(owner=user, name=f"f{i}")

    calls = []
    monkeypatch.setattr(build_mod, "_rebuild_in_background", lambda u: calls.append(u.pk))

    ensure_fresh(user)

    assert calls == [user.pk]
    # Nothing built inline (deferred to the background thread).
    assert GraphBuild.objects.filter(owner=user).first() is None

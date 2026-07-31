"""Regression tests for the standalone (single-deployment) settings profile.

These guard two bugs found during install-and-play validation, both specific to
the SQLite-backed standalone mode we recommend for self-hosting:

* search 500'd because the Postgres FTS service (websearch_to_tsquery) was
  inherited on a SQLite database;
* concurrent uploads intermittently 500'd with "database is locked" because
  SQLite wasn't in WAL mode and had no busy timeout under multiple workers.

The settings are loaded in isolation (importlib) so we can assert what the
profile computes from the environment without switching the test session's
DJANGO_SETTINGS_MODULE.
"""
import importlib

import pytest


def _load_standalone(monkeypatch, tmp_path, **env):
    monkeypatch.setenv("FLOPPY_DATA_DIR", str(tmp_path))
    # Ensure a clean SQLite default (no external DB / overrides leaking in).
    for k in ("DATABASE_URL", "SEARCH_SERVICE", "SQLITE_TIMEOUT", "FRONTEND_BASE_URL"):
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    mod = importlib.import_module("config.settings.standalone")
    return importlib.reload(mod)


def test_sqlite_default_uses_portable_search(monkeypatch, tmp_path):
    s = _load_standalone(monkeypatch, tmp_path)
    assert "sqlite" in s.DATABASES["default"]["ENGINE"]
    # NOT the Postgres FTS service, which crashes on SQLite.
    assert s.SEARCH_SERVICE == "apps.search.services.basic.BasicSearchService"


def test_sqlite_enables_wal_and_busy_timeout(monkeypatch, tmp_path):
    s = _load_standalone(monkeypatch, tmp_path)
    opts = s.DATABASES["default"]["OPTIONS"]
    assert opts["timeout"] >= 5  # a real busy timeout, not the sqlite default
    assert opts["transaction_mode"] == "IMMEDIATE"
    assert "journal_mode=WAL" in opts["init_command"]


def test_search_service_override_is_respected(monkeypatch, tmp_path):
    s = _load_standalone(
        monkeypatch, tmp_path, SEARCH_SERVICE="apps.search.services.postgres.PostgresSearchService"
    )
    assert s.SEARCH_SERVICE == "apps.search.services.postgres.PostgresSearchService"


def test_postgres_url_selects_fts_and_skips_sqlite_pragmas(monkeypatch, tmp_path):
    s = _load_standalone(
        monkeypatch, tmp_path, DATABASE_URL="postgres://u:p@localhost:5432/floppy"
    )
    assert "postgresql" in s.DATABASES["default"]["ENGINE"]
    assert s.SEARCH_SERVICE == "apps.search.services.postgres.PostgresSearchService"
    # SQLite-only pragmas must not be attached to a Postgres connection.
    assert "init_command" not in s.DATABASES["default"].get("OPTIONS", {})


def test_email_links_point_at_app_origin_not_vite(monkeypatch, tmp_path):
    s = _load_standalone(monkeypatch, tmp_path)
    # Must not be the dev Vite server; standalone serves the SPA same-origin.
    assert ":5173" not in s.FRONTEND_BASE_URL


@pytest.fixture(autouse=True)
def _restore_settings_module():
    """Reloading the standalone module mutates sys.modules; restore afterward."""
    yield
    import importlib

    importlib.import_module("config.settings.standalone")

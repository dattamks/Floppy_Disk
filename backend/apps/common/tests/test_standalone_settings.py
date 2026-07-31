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


def test_email_defaults_to_console_without_smtp(monkeypatch, tmp_path):
    for k in ("EMAIL_HOST", "EMAIL_BACKEND"):
        monkeypatch.delenv(k, raising=False)
    s = _load_standalone(monkeypatch, tmp_path)
    assert s.EMAIL_BACKEND.endswith("console.EmailBackend")


def test_setting_email_host_switches_to_smtp(monkeypatch, tmp_path):
    monkeypatch.delenv("EMAIL_BACKEND", raising=False)
    monkeypatch.setenv("EMAIL_HOST", "smtp.example.com")
    monkeypatch.setenv("EMAIL_HOST_USER", "me@example.com")
    monkeypatch.setenv("EMAIL_HOST_PASSWORD", "secret")
    s = _load_standalone(monkeypatch, tmp_path)
    assert s.EMAIL_BACKEND.endswith("smtp.EmailBackend")
    assert s.EMAIL_HOST == "smtp.example.com"
    assert s.EMAIL_PORT == 587 and s.EMAIL_USE_TLS is True and s.EMAIL_USE_SSL is False
    assert s.EMAIL_HOST_USER == "me@example.com"


def test_email_ssl_disables_tls(monkeypatch, tmp_path):
    monkeypatch.setenv("EMAIL_HOST", "smtp.example.com")
    monkeypatch.setenv("EMAIL_USE_SSL", "true")
    s = _load_standalone(monkeypatch, tmp_path)
    assert s.EMAIL_USE_SSL is True and s.EMAIL_USE_TLS is False


def test_no_proxy_ssl_header_or_hsts_by_default(monkeypatch, tmp_path):
    for k in ("USE_PROXY_SSL_HEADER", "SECURE_HSTS_SECONDS"):
        monkeypatch.delenv(k, raising=False)
    s = _load_standalone(monkeypatch, tmp_path)
    # Trusting X-Forwarded-Proto must be opt-in (else it can be spoofed).
    assert getattr(s, "SECURE_PROXY_SSL_HEADER", None) is None
    assert getattr(s, "SECURE_HSTS_SECONDS", 0) == 0


def test_proxy_ssl_header_and_hsts_opt_in(monkeypatch, tmp_path):
    monkeypatch.setenv("USE_PROXY_SSL_HEADER", "true")
    monkeypatch.setenv("SECURE_HSTS_SECONDS", "31536000")
    s = _load_standalone(monkeypatch, tmp_path)
    assert s.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")
    assert s.SECURE_HSTS_SECONDS == 31536000


@pytest.fixture(autouse=True)
def _restore_settings_module():
    """Reloading the standalone module mutates sys.modules; restore afterward."""
    yield
    import importlib

    importlib.import_module("config.settings.standalone")

"""The health probe must stay reachable over plain HTTP even with HTTPS redirect.

A container/proxy health check hits /health/ on the internal (plain-HTTP) hop.
If SECURE_SSL_REDIRECT bounced it to https:// the probe would 301 forever and
the deploy would be marked unhealthy, so /health/ is in SECURE_REDIRECT_EXEMPT.
"""
import pytest


@pytest.mark.django_db
def test_health_not_redirected_when_ssl_redirect_on(client, settings):
    settings.SECURE_SSL_REDIRECT = True
    resp = client.get("/health/")  # plain HTTP request
    assert resp.status_code == 200  # served, not 301'd to https


@pytest.mark.django_db
def test_other_paths_still_redirect_to_https(client, settings):
    settings.SECURE_SSL_REDIRECT = True
    resp = client.get("/api/v1/auth/me")  # not exempt
    assert resp.status_code in (301, 302)
    assert resp["Location"].startswith("https://")

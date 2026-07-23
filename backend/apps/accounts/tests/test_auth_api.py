"""
TDD spec for the Phase-1 email/password auth API.

Endpoints (mounted at /api/v1/auth/):
  POST   register                 -> 201, creates + logs in, age >= 18 required
  POST   login                    -> 200 on valid creds, 400 on bad
  POST   logout                   -> 204
  GET    me                       -> 200 (auth) / 403 (anon)
  GET    csrf                     -> 204, sets csrftoken cookie
  POST   password-reset           -> 204 always (no account enumeration)
  POST   verify-email             -> 200 valid token / 400 invalid
"""
import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

pytestmark = pytest.mark.django_db


def dob(years_ago):
    today = datetime.date.today()
    return today.replace(year=today.year - years_ago).isoformat()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="existing@floppy.disk", password="hunter2pass", display_name="Existing"
    )


# --- register ---------------------------------------------------------------

def test_register_creates_user_and_authenticates(client):
    resp = client.post(
        "/api/v1/auth/register",
        {"email": "new@floppy.disk", "password": "s3cretpass", "display_name": "New",
         "date_of_birth": dob(25)},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["email"] == "new@floppy.disk"
    assert body["email_verified"] is False
    assert User.objects.filter(email="new@floppy.disk").exists()
    # session established -> /me works without re-login
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "new@floppy.disk"


def test_register_rejects_under_18(client):
    resp = client.post(
        "/api/v1/auth/register",
        {"email": "kid@floppy.disk", "password": "s3cretpass", "date_of_birth": dob(15)},
        format="json",
    )
    assert resp.status_code == 400
    assert "date_of_birth" in resp.json()
    assert not User.objects.filter(email="kid@floppy.disk").exists()


def test_register_rejects_duplicate_email(client, user):
    resp = client.post(
        "/api/v1/auth/register",
        {"email": "existing@floppy.disk", "password": "s3cretpass", "date_of_birth": dob(30)},
        format="json",
    )
    assert resp.status_code == 400
    assert "email" in resp.json()


def test_register_rejects_short_password(client):
    resp = client.post(
        "/api/v1/auth/register",
        {"email": "x@floppy.disk", "password": "short", "date_of_birth": dob(30)},
        format="json",
    )
    assert resp.status_code == 400
    assert "password" in resp.json()


# --- login / logout ---------------------------------------------------------

def test_login_success(client, user):
    resp = client.post(
        "/api/v1/auth/login",
        {"email": "existing@floppy.disk", "password": "hunter2pass"},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    assert resp.json()["email"] == "existing@floppy.disk"


def test_login_is_case_insensitive_on_email(client, user):
    resp = client.post(
        "/api/v1/auth/login",
        {"email": "EXISTING@floppy.disk", "password": "hunter2pass"},
        format="json",
    )
    assert resp.status_code == 200, resp.content


def test_login_bad_password(client, user):
    resp = client.post(
        "/api/v1/auth/login",
        {"email": "existing@floppy.disk", "password": "wrongpass"},
        format="json",
    )
    assert resp.status_code == 400


def test_logout_clears_session(client, user):
    client.post(
        "/api/v1/auth/login",
        {"email": "existing@floppy.disk", "password": "hunter2pass"},
        format="json",
    )
    assert client.get("/api/v1/auth/me").status_code == 200
    out = client.post("/api/v1/auth/logout")
    assert out.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 403


# --- me ---------------------------------------------------------------------

def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 403


# --- csrf -------------------------------------------------------------------

def test_csrf_endpoint_sets_cookie(client):
    resp = client.get("/api/v1/auth/csrf")
    assert resp.status_code == 204
    assert "csrftoken" in resp.cookies


# --- password reset ---------------------------------------------------------

def test_password_reset_request_is_always_204(client, user):
    # existing account
    assert client.post("/api/v1/auth/password-reset",
                       {"email": "existing@floppy.disk"}, format="json").status_code == 204
    # unknown account -> still 204 (no enumeration)
    assert client.post("/api/v1/auth/password-reset",
                       {"email": "nobody@floppy.disk"}, format="json").status_code == 204


# --- verify email -----------------------------------------------------------

def test_verify_email_with_valid_token(client, user):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = f"{uid}:{default_token_generator.make_token(user)}"
    resp = client.post("/api/v1/auth/verify-email", {"token": token}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.email_verified is True


def test_verify_email_with_bad_token(client, user):
    resp = client.post("/api/v1/auth/verify-email", {"token": "garbage:token"}, format="json")
    assert resp.status_code == 400
    user.refresh_from_db()
    assert user.email_verified is False

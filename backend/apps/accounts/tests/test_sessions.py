"""Sign out of all *other* sessions: kills this user's other sessions, keeps mine."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db


def _register(client, email="me@floppy.disk"):
    resp = client.post(
        "/api/v1/auth/register",
        {"email": email, "password": "s3cretpass", "display_name": "Me",
         "date_of_birth": "1990-01-01"},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    return User.objects.get(email=email)


def _fake_session_for(user):
    """Simulate another logged-in device by writing a session row for the user."""
    s = SessionStore()
    s["_auth_user_id"] = str(user.id)
    s.create()
    return s.session_key


def test_revoke_other_sessions_kills_others_keeps_current():
    client = APIClient()
    user = _register(client)  # this establishes the client's own session
    other_a = _fake_session_for(user)
    other_b = _fake_session_for(user)
    assert Session.objects.filter(session_key__in=[other_a, other_b]).count() == 2

    resp = client.post("/api/v1/auth/account/sessions/revoke-others")
    assert resp.status_code == 200, resp.content
    assert resp.json()["revoked"] == 2

    # The other devices are signed out...
    assert Session.objects.filter(session_key__in=[other_a, other_b]).count() == 0
    # ...but my current session still works.
    assert client.get("/api/v1/auth/me").status_code == 200


def test_revoke_other_sessions_does_not_touch_another_users_sessions():
    client = APIClient()
    me = _register(client, email="a@floppy.disk")
    other_user = User.objects.create_user(email="b@floppy.disk", password="pw")
    their_session = _fake_session_for(other_user)

    resp = client.post("/api/v1/auth/account/sessions/revoke-others")
    assert resp.status_code == 200
    assert resp.json()["revoked"] == 0
    # Another user's session is untouched.
    assert Session.objects.filter(session_key=their_session).exists()

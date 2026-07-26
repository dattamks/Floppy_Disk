"""TDD spec for notifications: read state + owner scoping."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.notifications.dispatch import notify

User = get_user_model()
pytestmark = pytest.mark.django_db


def user(email):
    return User.objects.create_user(email=email, password="hunter2pass")


def client_for(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


@pytest.fixture
def owner(db):
    return user("owner@floppy.disk")


@pytest.fixture
def owner_client(owner):
    return client_for(owner)


def _notify(u, title="Heads up"):
    notify(u, type="system", title=title, body="…")


def test_mark_one_read_decrements_unread(owner_client, owner):
    _notify(owner)
    data = owner_client.get("/api/v1/notifications/").json()
    assert data["unread_count"] == 1
    nid = data["results"][0]["id"]

    assert owner_client.post(f"/api/v1/notifications/{nid}/read").status_code == 204
    assert owner_client.get("/api/v1/notifications/").json()["unread_count"] == 0


def test_mark_all_read(owner_client, owner):
    _notify(owner, "a")
    _notify(owner, "b")
    assert owner_client.get("/api/v1/notifications/").json()["unread_count"] == 2
    assert owner_client.post("/api/v1/notifications/read-all").status_code == 204
    assert owner_client.get("/api/v1/notifications/").json()["unread_count"] == 0


def test_notifications_are_owner_scoped(owner_client, owner):
    _notify(owner)
    other = client_for(user("other@floppy.disk"))
    assert other.get("/api/v1/notifications/").json()["unread_count"] == 0


def test_notifications_require_auth():
    assert APIClient().get("/api/v1/notifications/").status_code == 403

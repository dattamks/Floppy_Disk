"""TDD spec for notifications: fan-out on channel events + read state."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.notifications.models import Notification

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


def _channel(client, handle="chan"):
    return client.post("/api/v1/channels/", {"name": "Chan", "handle": handle}, format="json").json()


def test_creating_a_channel_notifies_the_owner(owner_client, owner):
    _channel(owner_client)
    resp = owner_client.get("/api/v1/notifications/").json()
    assert resp["unread_count"] == 1
    assert resp["results"][0]["type"] == "channel_created"


def test_posting_notifies_subscribers_not_author(owner_client, owner):
    ch = _channel(owner_client, handle="feed")
    sub = user("sub@floppy.disk")
    sclient = client_for(sub)
    sclient.post(f"/api/v1/channels/{ch['id']}/subscribe")

    owner_client.post(f"/api/v1/channels/{ch['id']}/posts", {"caption": "hello all"}, format="json")

    # subscriber got a channel_post notification
    sub_notifs = sclient.get("/api/v1/notifications/").json()
    assert any(n["type"] == "channel_post" for n in sub_notifs["results"])

    # author did NOT get a channel_post notification for their own post
    owner_notifs = owner_client.get("/api/v1/notifications/").json()
    assert not any(n["type"] == "channel_post" for n in owner_notifs["results"])


def test_mark_one_read_decrements_unread(owner_client, owner):
    _channel(owner_client)
    data = owner_client.get("/api/v1/notifications/").json()
    assert data["unread_count"] == 1
    nid = data["results"][0]["id"]

    assert owner_client.post(f"/api/v1/notifications/{nid}/read").status_code == 204
    assert owner_client.get("/api/v1/notifications/").json()["unread_count"] == 0


def test_mark_all_read(owner_client, owner):
    _channel(owner_client, handle="a")
    _channel(owner_client, handle="b")
    assert owner_client.get("/api/v1/notifications/").json()["unread_count"] == 2
    assert owner_client.post("/api/v1/notifications/read-all").status_code == 204
    assert owner_client.get("/api/v1/notifications/").json()["unread_count"] == 0


def test_notifications_are_owner_scoped(owner_client, owner):
    _channel(owner_client)
    other = client_for(user("other@floppy.disk"))
    assert other.get("/api/v1/notifications/").json()["unread_count"] == 0


def test_notifications_require_auth():
    assert APIClient().get("/api/v1/notifications/").status_code == 403

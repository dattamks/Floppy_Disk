"""TDD spec for channels: create, discover, subscribe, role-gated posting."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.channels.models import Channel, ChannelMembership

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


def _make_channel(client, handle="mychan", is_public=True):
    return client.post("/api/v1/channels/", {"name": "My Channel", "handle": handle, "is_public": is_public}, format="json")


# --- create -----------------------------------------------------------------

def test_create_channel_makes_creator_owner(owner_client, owner):
    resp = _make_channel(owner_client)
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["handle"] == "mychan"
    assert body["role"] == "owner"
    assert ChannelMembership.objects.get(channel_id=body["id"], user=owner).role == "owner"


def test_handle_must_be_unique(owner_client):
    _make_channel(owner_client, handle="dup")
    resp = _make_channel(owner_client, handle="dup")
    assert resp.status_code == 400
    assert "handle" in resp.json()


# --- discover ---------------------------------------------------------------

def test_public_channels_are_discoverable_private_are_not(owner_client, db):
    _make_channel(owner_client, handle="pub", is_public=True)
    _make_channel(owner_client, handle="priv", is_public=False)

    stranger = client_for(user("stranger@floppy.disk"))
    handles = [c["handle"] for c in stranger.get("/api/v1/channels/").json()]
    assert "pub" in handles
    assert "priv" not in handles


# --- subscribe --------------------------------------------------------------

def test_subscribe_and_unsubscribe(owner_client):
    ch = _make_channel(owner_client, handle="news").json()
    sub = client_for(user("sub@floppy.disk"))

    r = sub.post(f"/api/v1/channels/{ch['id']}/subscribe")
    assert r.status_code == 200
    assert r.json()["role"] == "subscriber"
    assert [c["handle"] for c in sub.get("/api/v1/channels/?mine=1").json()] == ["news"]

    r = sub.delete(f"/api/v1/channels/{ch['id']}/subscribe")
    assert r.status_code == 204
    assert sub.get("/api/v1/channels/?mine=1").json() == []


def test_owner_cannot_unsubscribe(owner_client, owner):
    ch = _make_channel(owner_client, handle="mine").json()
    assert owner_client.delete(f"/api/v1/channels/{ch['id']}/subscribe").status_code == 400


# --- posting (role gated) ---------------------------------------------------

def test_owner_can_post_subscriber_cannot(owner_client):
    ch = _make_channel(owner_client, handle="feed").json()
    assert owner_client.post(f"/api/v1/channels/{ch['id']}/posts", {"caption": "hello"}, format="json").status_code == 201

    sub = client_for(user("viewer@floppy.disk"))
    sub.post(f"/api/v1/channels/{ch['id']}/subscribe")
    resp = sub.post(f"/api/v1/channels/{ch['id']}/posts", {"caption": "spam"}, format="json")
    assert resp.status_code == 403


def test_owner_promotes_subscriber_to_admin_who_can_then_post(owner_client, owner):
    ch = _make_channel(owner_client, handle="team").json()
    contributor = user("contrib@floppy.disk")
    cclient = client_for(contributor)
    cclient.post(f"/api/v1/channels/{ch['id']}/subscribe")

    # promote (grants posting rights)
    promote = owner_client.post(f"/api/v1/channels/{ch['id']}/members/{contributor.id}/promote")
    assert promote.status_code == 200
    assert promote.json()["role"] == "admin"

    # now the contributor can post
    assert cclient.post(f"/api/v1/channels/{ch['id']}/posts", {"caption": "hi team"}, format="json").status_code == 201


def test_non_owner_cannot_promote(owner_client):
    ch = _make_channel(owner_client, handle="locked").json()
    other = user("other@floppy.disk")
    oclient = client_for(other)
    oclient.post(f"/api/v1/channels/{ch['id']}/subscribe")
    # a subscriber trying to promote themselves
    resp = oclient.post(f"/api/v1/channels/{ch['id']}/members/{other.id}/promote")
    assert resp.status_code == 403


def test_posts_list_visible_on_public_channel(owner_client):
    ch = _make_channel(owner_client, handle="open").json()
    owner_client.post(f"/api/v1/channels/{ch['id']}/posts", {"caption": "first"}, format="json")
    stranger = client_for(user("peek@floppy.disk"))
    posts = stranger.get(f"/api/v1/channels/{ch['id']}/posts").json()
    assert [p["caption"] for p in posts] == ["first"]

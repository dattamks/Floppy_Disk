"""The instance Owner: first registered user or a superuser."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db

REG = {"password": "hunter2pass!", "date_of_birth": "1990-01-01"}


def _register(email):
    return APIClient().post(
        "/api/v1/auth/register", {"email": email, **REG}, format="json"
    )


def test_first_registered_user_becomes_owner():
    r = _register("first@floppy.disk")
    assert r.status_code == 201, r.content
    assert r.json()["is_owner"] is True
    assert User.objects.get(email="first@floppy.disk").is_owner is True


def test_second_user_is_not_owner():
    _register("first@floppy.disk")
    r = _register("second@floppy.disk")
    assert r.status_code == 201, r.content
    assert r.json()["is_owner"] is False
    assert User.objects.get(email="second@floppy.disk").is_owner is False


def test_superuser_is_owner_even_without_flag():
    su = User.objects.create_superuser(email="root@floppy.disk", password="x")
    assert su.is_owner is False        # flag not set
    assert su.is_owner_effective is True  # but superuser counts as owner


def test_owner_flag_user_is_effective_owner():
    u = User.objects.create_user(email="o@floppy.disk", password="x", is_owner=True)
    assert u.is_owner_effective is True


def test_plain_user_is_not_owner():
    u = User.objects.create_user(email="u@floppy.disk", password="x")
    assert u.is_owner_effective is False


def test_me_endpoint_exposes_is_owner():
    _register("first@floppy.disk")
    c = APIClient()
    c.force_authenticate(User.objects.get(email="first@floppy.disk"))
    me = c.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["is_owner"] is True

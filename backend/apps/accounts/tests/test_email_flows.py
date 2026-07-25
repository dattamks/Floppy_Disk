"""TDD: registration and password-reset actually send email (dev: locmem)."""
import re

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pytestmark = pytest.mark.django_db


def _token_from(body):
    m = re.search(r"token=([^\s&]+)", body)
    return m.group(1) if m else None


def test_registration_sends_working_verification_email(mailoutbox):
    c = APIClient()
    resp = c.post(
        "/api/v1/auth/register",
        {"email": "newbie@floppy.disk", "password": "hunter2pass",
         "display_name": "New", "date_of_birth": "1995-01-01"},
        format="json",
    )
    assert resp.status_code in (200, 201), resp.content
    assert len(mailoutbox) == 1
    msg = mailoutbox[0]
    assert "newbie@floppy.disk" in msg.to
    assert "verif" in (msg.subject + msg.body).lower()

    token = _token_from(msg.body)
    assert token, msg.body
    verify = c.post("/api/v1/auth/verify-email", {"token": token}, format="json")
    assert verify.status_code == 200, verify.content
    assert User.objects.get(email="newbie@floppy.disk").email_verified is True


def test_password_reset_sends_email(mailoutbox):
    User.objects.create_user(email="reset@floppy.disk", password="hunter2pass")
    resp = APIClient().post("/api/v1/auth/password-reset", {"email": "reset@floppy.disk"}, format="json")
    assert resp.status_code in (200, 204)
    assert len(mailoutbox) == 1
    assert "reset@floppy.disk" in mailoutbox[0].to
    assert _token_from(mailoutbox[0].body)


def test_password_reset_unknown_email_sends_nothing(mailoutbox):
    resp = APIClient().post("/api/v1/auth/password-reset", {"email": "ghost@floppy.disk"}, format="json")
    assert resp.status_code in (200, 204)  # no account enumeration
    assert len(mailoutbox) == 0

"""TDD: public legal surface — policy versions, grievance officer, filing."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.common.models import Grievance

User = get_user_model()
pytestmark = pytest.mark.django_db


def test_legal_info_is_public(settings):
    settings.GRIEVANCE_OFFICER_EMAIL = "officer@floppy.disk"
    settings.TOS_VERSION = "2026-01-01"
    resp = APIClient().get("/api/v1/legal/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["policies"]["tos"]["version"] == "2026-01-01"
    assert body["policies"]["privacy"]["version"]
    assert body["grievance_officer"]["email"] == "officer@floppy.disk"


def test_file_grievance_anonymous(settings):
    resp = APIClient().post(
        "/api/v1/legal/grievance",
        {"subject": "Content complaint", "body": "Please review file X.", "email": "me@x.com"},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["ticket"]
    assert body["status"] == "received"
    g = Grievance.objects.get(id=body["ticket"])
    assert g.subject == "Content complaint"
    assert g.email == "me@x.com"
    assert g.reporter is None


def test_file_grievance_authenticated_links_user(db):
    user = User.objects.create_user(email="g@floppy.disk", password="hunter2pass")
    c = APIClient(); c.force_authenticate(user)
    resp = c.post("/api/v1/legal/grievance", {"subject": "Hi", "body": "Issue"}, format="json")
    assert resp.status_code == 201
    g = Grievance.objects.get(id=resp.json()["ticket"])
    assert g.reporter_id == user.id
    assert g.email == user.email


def test_grievance_requires_subject_and_body():
    resp = APIClient().post("/api/v1/legal/grievance", {"subject": "only"}, format="json")
    assert resp.status_code == 400

"""TDD spec for analytics: key product events are recorded via track()."""
import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.analytics.models import AnalyticsEvent

User = get_user_model()
pytestmark = pytest.mark.django_db


def _dob(y):
    t = datetime.date.today()
    return t.replace(year=t.year - y).isoformat()


def test_track_records_event_with_month_and_props(db):
    from apps.analytics.track import track
    u = User.objects.create_user(email="a@floppy.disk", password="hunter2pass")
    ev = track("custom_event", user=u, foo="bar")
    assert ev.name == "custom_event"
    assert ev.properties == {"foo": "bar"}
    assert len(ev.month) == 7 and ev.month[4] == "-"


def test_signup_emits_analytics_event(db):
    APIClient().post("/api/v1/auth/register",
                     {"email": "s@floppy.disk", "password": "s3cretpass", "date_of_birth": _dob(30)},
                     format="json")
    ev = AnalyticsEvent.objects.filter(name="signup").first()
    assert ev is not None
    assert ev.user.email == "s@floppy.disk"


def test_upload_complete_emits_event(db):
    u = User.objects.create_user(email="u@floppy.disk", password="hunter2pass")
    c = APIClient(); c.force_authenticate(u)
    payload = b"hello"
    init = c.post("/api/v1/storage/uploads",
                  {"name": "n.txt", "size_bytes": len(payload), "kind": "doc"}, format="json").json()
    c.put(init["upload"]["url"], data=payload, content_type="application/octet-stream")
    c.post(f"/api/v1/storage/uploads/{init['file']['id']}/complete")
    assert AnalyticsEvent.objects.filter(name="upload_complete", user=u).exists()



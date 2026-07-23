"""Rate-limit enforcement: scoped throttles return 429 past the limit (PRD 5.2)."""
import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APIClient

from apps.moderation.views import ReportCreateView
from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db


class _TinyReportThrottle(ScopedRateThrottle):
    # Fixed rate so the test doesn't depend on settings-reload timing.
    THROTTLE_RATES = {"report": "3/day"}


def test_report_endpoint_throttles_after_limit(db, monkeypatch):
    # Attach a real throttle (with a tiny rate) to the view; the view already
    # declares throttle_scope = "report".
    monkeypatch.setattr(ReportCreateView, "throttle_classes", [_TinyReportThrottle])
    cache.clear()  # throttle history lives in the process-wide cache

    user = User.objects.create_user(email="rl@floppy.disk", password="hunter2pass")
    obj = StorageObject.objects.create(content_hash="a" * 64, region=user.storage_region,
                                       size_bytes=10, ref_count=1, status=StorageObject.Status.READY)
    f = File.objects.create(owner=user, name="x", size_bytes=10,
                            status=File.Status.READY, storage_object=obj)

    c = APIClient()
    c.force_authenticate(user)
    body = {"kind": "flag", "target_type": "file", "target_id": str(f.id), "reason": "other"}

    statuses = [c.post("/api/v1/moderation/reports", body, format="json").status_code
                for _ in range(4)]
    cache.clear()

    assert statuses[:3] == [201, 201, 201]  # 3 allowed
    assert statuses[3] == 429               # 4th rate-limited

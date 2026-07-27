"""TDD spec for moderation: malware scan on upload + two-step reporting."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.moderation.models import ContentReport
from apps.storage.models import File, StorageObject

User = get_user_model()
pytestmark = pytest.mark.django_db

EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
CLEAN = b"a perfectly ordinary text file"


@pytest.fixture
def user(db):
    return User.objects.create_user(email="m@floppy.disk", password="hunter2pass")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _upload(client, name, payload):
    init = client.post("/api/v1/storage/uploads",
                       {"name": name, "size_bytes": len(payload), "kind": "doc"}, format="json").json()
    client.put(init["upload"]["url"], data=payload, content_type="application/octet-stream")
    return init["file"]["id"], client.post(f"/api/v1/storage/uploads/{init['file']['id']}/complete")


# --- malware scan -----------------------------------------------------------

def test_clean_upload_completes_ready(client, user):
    fid, resp = _upload(client, "ok.txt", CLEAN)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"
    assert File.objects.get(pk=fid).is_quarantined is False


def test_infected_upload_is_blocked_and_quarantined(client, user):
    fid, resp = _upload(client, "virus.txt", EICAR)
    assert resp.status_code == 422
    assert resp.json()["code"] == "scan_failed"

    f = File.objects.get(pk=fid)
    assert f.is_quarantined is True
    assert f.status == File.Status.FAILED
    # blocked file never appears in listings...
    assert client.get("/api/v1/storage/files").json() == []
    # ...and no quota was committed (reservation released, not committed)
    user.refresh_from_db()
    assert user.storage_used_bytes == 0
    # no StorageObject was created for infected content
    assert StorageObject.objects.count() == 0


# --- reporting --------------------------------------------------------------

def _ready_file(user):
    obj = StorageObject.objects.create(content_hash="a" * 64, region=user.storage_region,
                                       size_bytes=10, ref_count=1, status=StorageObject.Status.READY)
    return File.objects.create(owner=user, name="pub.txt", size_bytes=10,
                               status=File.Status.READY, storage_object=obj)


def test_flag_records_without_isolating(client, user):
    f = _ready_file(user)
    resp = client.post("/api/v1/moderation/reports",
                       {"kind": "flag", "target_type": "file", "target_id": str(f.id), "reason": "inappropriate"},
                       format="json")
    assert resp.status_code == 201
    f.refresh_from_db()
    assert f.is_quarantined is False  # a Flag takes no automatic action


def test_report_isolates_file_immediately(client, user):
    f = _ready_file(user)
    resp = client.post("/api/v1/moderation/reports",
                       {"kind": "report", "target_type": "file", "target_id": str(f.id), "reason": "inappropriate"},
                       format="json")
    assert resp.status_code == 201
    f.refresh_from_db()
    assert f.is_quarantined is True  # a Report triggers reversible isolation
    assert ContentReport.objects.filter(target_id=f.id, kind="report").exists()


def test_report_cannot_take_down_arbitrary_private_file(client, user):
    """A user must not be able to quarantine another user's private file by UUID."""
    victim = User.objects.create_user(email="victim@floppy.disk", password="hunter2pass")
    private = _ready_file(victim)  # not discoverable, not shared

    resp = client.post("/api/v1/moderation/reports",
                       {"kind": "report", "target_type": "file",
                        "target_id": str(private.id), "reason": "inappropriate"},
                       format="json")
    # The report is still recorded (for abuse-pattern analysis)...
    assert resp.status_code == 201
    assert ContentReport.objects.filter(target_id=private.id, kind="report").exists()
    # ...but the private file is NOT auto-isolated.
    private.refresh_from_db()
    assert private.is_quarantined is False


def test_report_isolates_discoverable_file(client, user):
    """Discoverable content the reporter can actually reach is still auto-isolated."""
    victim = User.objects.create_user(email="victim2@floppy.disk", password="hunter2pass")
    pub = _ready_file(victim)
    File.objects.filter(pk=pub.id).update(is_discoverable=True)

    resp = client.post("/api/v1/moderation/reports",
                       {"kind": "report", "target_type": "file",
                        "target_id": str(pub.id), "reason": "inappropriate"},
                       format="json")
    assert resp.status_code == 201
    pub.refresh_from_db()
    assert pub.is_quarantined is True


def test_copyright_report_requires_detail(client, user):
    f = _ready_file(user)
    resp = client.post("/api/v1/moderation/reports",
                       {"kind": "report", "target_type": "file", "target_id": str(f.id), "reason": "copyright"},
                       format="json")
    assert resp.status_code == 400  # DMCA-style: must identify yourself


def test_report_requires_auth():
    assert APIClient().post("/api/v1/moderation/reports", {}, format="json").status_code == 403


# --- scanner-downtime policy (fail-closed by default) -----------------------

class _BoomScanner:
    def scan(self, data):
        raise ConnectionRefusedError("clamd is unreachable")


def test_scanner_unavailable_fails_closed(client, user, monkeypatch, settings):
    """Default policy: an unreachable scanner blocks + quarantines the upload."""
    settings.SCAN_FAILURE_MODE = "closed"
    from apps.moderation.services import base as scanbase
    monkeypatch.setattr(scanbase, "get_scan_service", lambda: _BoomScanner())

    fid, resp = _upload(client, "doc.txt", CLEAN)
    assert resp.status_code == 503
    assert resp.json()["code"] == "scan_unavailable"
    assert File.objects.get(pk=fid).is_quarantined is True


def test_scanner_unavailable_fail_open_lets_through(client, user, monkeypatch, settings):
    """Opt-in policy: an unreachable scanner lets the upload through unscanned."""
    settings.SCAN_FAILURE_MODE = "open"
    from apps.moderation.services import base as scanbase
    monkeypatch.setattr(scanbase, "get_scan_service", lambda: _BoomScanner())

    fid, resp = _upload(client, "doc.txt", CLEAN)
    assert resp.status_code == 200
    f = File.objects.get(pk=fid)
    assert f.status == File.Status.READY
    assert f.is_quarantined is False

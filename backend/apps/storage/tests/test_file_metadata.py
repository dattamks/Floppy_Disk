"""User-authored metadata (description + tags) and extracted media metadata.

Covers the editable Details-panel fields (description/tags) - persistence,
normalization, and searchability - plus best-effort image dimension probing and
the graceful degradation of the optional PDF/OCR text-extraction paths.
"""
import struct

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.mediameta import image_dimensions
from apps.storage.models import File

User = get_user_model()
pytestmark = pytest.mark.django_db


def _client(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def _upload(client, content=b"hi", name="note.txt", kind="doc"):
    init = client.post(
        "/api/v1/storage/uploads",
        {"name": name, "size_bytes": len(content), "kind": kind},
        format="json",
    ).json()
    fid = init["file"]["id"]
    client.put(init["upload"]["url"], data=content, content_type="application/octet-stream")
    client.post(f"/api/v1/storage/uploads/{fid}/complete")
    return fid


# ------------------------------------------------------------ description ----
def test_description_persists_via_patch(db):
    u = User.objects.create_user(email="m1@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c)

    resp = c.patch(f"/api/v1/storage/files/{fid}", {"description": "Quarterly report"}, format="json")
    assert resp.status_code == 200, resp.content
    assert resp.json()["description"] == "Quarterly report"

    row = next(f for f in c.get("/api/v1/storage/files").json() if f["id"] == fid)
    assert row["description"] == "Quarterly report"


def test_description_is_length_capped(db):
    u = User.objects.create_user(email="m2@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c)
    resp = c.patch(f"/api/v1/storage/files/{fid}", {"description": "x" * 5000}, format="json")
    assert len(resp.json()["description"]) == 4000


# ------------------------------------------------------------------ tags ----
def test_tags_accepts_list_and_dedups(db):
    u = User.objects.create_user(email="m3@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c)
    resp = c.patch(
        f"/api/v1/storage/files/{fid}",
        {"tags": ["Work", "  work ", "urgent", ""]},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    # case-insensitive dedup, trimmed, empties dropped, order preserved
    assert resp.json()["tags"] == ["Work", "urgent"]


def test_tags_accepts_comma_string(db):
    u = User.objects.create_user(email="m4@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c)
    resp = c.patch(f"/api/v1/storage/files/{fid}", {"tags": "a, b ,c"}, format="json")
    assert resp.json()["tags"] == ["a", "b", "c"]


def test_tags_are_count_and_length_capped(db):
    u = User.objects.create_user(email="m5@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c)
    resp = c.patch(
        f"/api/v1/storage/files/{fid}",
        {"tags": [f"tag{i}" for i in range(50)] + ["z" * 60]},
        format="json",
    )
    tags = resp.json()["tags"]
    assert len(tags) == 30
    assert all(len(t) <= 40 for t in tags)


def test_metadata_edit_does_not_rename_or_move(db):
    u = User.objects.create_user(email="m6@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c, name="keep.txt")
    c.patch(f"/api/v1/storage/files/{fid}", {"tags": ["x"], "description": "y"}, format="json")
    row = next(f for f in c.get("/api/v1/storage/files").json() if f["id"] == fid)
    assert row["name"] == "keep.txt"


# ---------------------------------------------------------------- search ----
def test_search_matches_description_and_tags(db):
    u = User.objects.create_user(email="m7@floppy.disk", password="pw")
    c = _client(u)
    fid = _upload(c, name="opaque.txt", content=b"nothing useful")
    c.patch(
        f"/api/v1/storage/files/{fid}",
        {"description": "annual budget planning", "tags": ["finance"]},
        format="json",
    )

    # A description word finds it even though the filename/content don't match.
    hits = c.get("/api/v1/storage/search?q=budget").json()["results"]
    assert any(h["id"] == fid for h in hits)

    # A tag finds it too.
    hits = c.get("/api/v1/storage/search?q=finance").json()["results"]
    assert any(h["id"] == fid for h in hits)


# ------------------------------------------------------------ dimensions ----
def test_image_dimensions_png():
    # 8-byte sig + IHDR length/type + width/height big-endian uint32.
    png = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + struct.pack(">II", 640, 480)
    assert image_dimensions(png + b"\x00" * 8) == (640, 480)


def test_image_dimensions_gif():
    gif = b"GIF89a" + struct.pack("<HH", 320, 200) + b"\x00" * 20
    assert image_dimensions(gif) == (320, 200)


def test_image_dimensions_bmp():
    bmp = b"BM" + b"\x00" * 16 + struct.pack("<ii", 100, 50) + b"\x00" * 8
    assert image_dimensions(bmp) == (100, 50)


def test_image_dimensions_rejects_garbage():
    assert image_dimensions(b"not an image at all, really") is None
    assert image_dimensions(b"") is None


def test_probe_media_sets_dimensions_on_upload(db):
    u = User.objects.create_user(email="m8@floppy.disk", password="pw")
    c = _client(u)
    png = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + struct.pack(">II", 12, 34) + b"\x00" * 8
    fid = _upload(c, content=png, name="pic.png", kind="image")
    f = File.objects.get(pk=fid)
    assert (f.width, f.height) == (12, 34)


# ------------------------------------------------------------- optional -----
def test_pdf_and_ocr_extraction_degrade_gracefully(db):
    """Without pypdf/tesseract installed, text extraction is a safe no-op."""
    from apps.storage.indexing import _ocr, _pdf_text

    # These must never raise regardless of whether the optional deps exist.
    assert isinstance(_pdf_text(b"%PDF-1.4 not really a pdf"), str)
    assert isinstance(_ocr(b"not really an image"), str)

"""Serve the built single-page app for non-API routes (standalone mode).

Static assets (/assets/...) are served by WhiteNoise from WHITENOISE_ROOT; any
other path that isn't an API/admin/health route returns index.html so the SPA
can boot and handle it client-side.
"""
from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse


def spa_index(request):
    dist = getattr(settings, "FRONTEND_DIST", None)
    if not dist:
        raise Http404()
    index = Path(dist) / "index.html"
    if not index.exists():
        raise Http404()
    return HttpResponse(index.read_bytes(), content_type="text/html")

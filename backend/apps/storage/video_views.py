"""Basic video playback for your own files (Drive-style inline preview).

The video *streaming platform* (Cloudflare Stream / HLS promotion, HD tiering,
the Stream webhook) was deactivated in the Drive-focus pivot — see
`deactivated/video_streaming.py` and `docs/deactivated-features.md`.
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import File
from .services.base import get_storage_service


def _owned_video(request, file_id):
    return File.objects.filter(
        pk=file_id, owner=request.user, deleted_at__isnull=True,
        is_quarantined=False, kind=File.Kind.VIDEO,
    ).first()


class VideoPlayView(APIView):
    """Return a direct URL to play an owned video inline (no adaptive streaming)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        file = _owned_video(request, file_id)
        if file is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if file.status != File.Status.READY:
            return Response({"detail": "Video is still processing."}, status=status.HTTP_409_CONFLICT)
        obj = file.storage_object
        url = get_storage_service().presign_download(region=obj.region, object_key=obj.object_key)
        return Response({"mode": "direct", "url": url})

"""Self-hosted video playback for your own files (Drive-style inline preview).

Uploaded videos are normalized to a browser-playable H.264/AAC MP4 with FFmpeg
on our own servers (see `services/transcode.py` + `video_processing.py`) and
served over the local HTTP Range endpoint — no Cloudflare Stream, no external
streaming service.
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
        kind=File.Kind.VIDEO,
    ).select_related("playable_object", "poster_object", "storage_object").first()


class VideoPlayView(APIView):
    """Return a direct URL to play an owned video inline (self-hosted MP4)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        file = _owned_video(request, file_id)
        if file is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if file.status == File.Status.PROCESSING:
            return Response(
                {"detail": "Video is still processing.", "code": "processing"},
                status=status.HTTP_409_CONFLICT,
            )
        if file.status != File.Status.READY:
            return Response({"detail": "Video is not ready."}, status=status.HTTP_409_CONFLICT)

        storage = get_storage_service()
        # Prefer the transcoded rendition; fall back to the original object.
        obj = file.playable_object or file.storage_object
        if obj is None:
            return Response({"detail": "Video is not ready."}, status=status.HTTP_409_CONFLICT)
        body = {
            "mode": "direct",
            "url": storage.presign_download(region=obj.region, object_key=obj.object_key),
        }
        if file.poster_object_id:
            p = file.poster_object
            body["poster"] = storage.presign_download(region=p.region, object_key=p.object_key)
        if file.duration_seconds is not None:
            body["duration_seconds"] = file.duration_seconds
        return Response(body)

"""DEACTIVATED — video streaming platform (Cloudflare Stream / HLS).

Pulled out of apps/storage in the Drive-focus pivot (basic inline playback of
your own files stays in apps/storage/video_views.py). Preserved verbatim so it
can be switched back on. See docs/deactivated-features.md.

To re-enable: restore the `promote` and `stream/webhook` routes in
apps/storage/urls.py (pointing here), re-add the HD/SD `max_resolution` gating
and the HLS branch to VideoPlayView, and re-wire the frontend player controls.
"""
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.service import process_webhook_event
from apps.storage.models import File
from apps.storage.services.video import get_video_service


def _max_resolution(user) -> str:
    # Free tier is resolution-capped (SD); paid gets full/HD (PRD 5.5).
    return "sd" if user.tier == user.Tier.FREE else "hd"


def _owned_video(request, file_id):
    return File.objects.filter(
        pk=file_id, owner=request.user, deleted_at__isnull=True,
        is_quarantined=False, kind=File.Kind.VIDEO,
    ).first()


class VideoPromoteView(APIView):
    """'Watch in HD' / discoverable -> promote the R2 object into Stream."""

    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        from django.conf import settings
        if not settings.CLOUDFLARE_STREAM_ENABLED:
            return Response(
                {"detail": "HD streaming is not available.", "code": "stream_unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        file = _owned_video(request, file_id)
        if file is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if file.status != File.Status.READY or not file.storage_object_id:
            return Response({"detail": "Video not ready."}, status=status.HTTP_409_CONFLICT)
        obj = file.storage_object
        if not file.stream_uid:
            file.stream_uid = get_video_service().promote(region=obj.region, object_key=obj.object_key)
            file.save(update_fields=["stream_uid", "updated_at"])
        return Response({"stream_uid": file.stream_uid,
                         "hls_url": get_video_service().hls_url(stream_uid=file.stream_uid)})


class StreamWebhookView(APIView):
    """Cloudflare Stream processing-complete callback (idempotent)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        import json
        try:
            body = json.loads(request.body or b"{}")
        except ValueError:
            return Response({"detail": "Bad payload."}, status=status.HTTP_400_BAD_REQUEST)
        event_id = body.get("uid") or body.get("id")
        if not event_id:
            return Response({"detail": "Missing uid."}, status=status.HTTP_400_BAD_REQUEST)
        newly = process_webhook_event(
            gateway="cloudflare_stream",
            event={"id": event_id, "type": body.get("status", "")},
        )
        return Response({"processed": newly})

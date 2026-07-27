"""
Sharing API: owner-managed share links + a public token resolver.

Password protection is a paid-tier feature (PRD 5.4). The public resolver needs
no auth — the token is the capability.
"""
from django.contrib.auth.hashers import check_password, make_password
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.storage.models import File
from apps.storage.services.base import get_storage_service

from .models import ShareLink
from .serializers import ShareLinkSerializer


def _target_available(link) -> bool:
    """Is the link's target still safe to serve publicly?

    A share is only a capability to reach content that is *currently* public:
    a file that gets trashed, quarantined (malware/report), frozen (lapsed
    subscription), or is not yet ready must stop resolving even while the token
    itself is un-revoked and un-expired. Without this, an active link keeps
    serving content the owner can no longer even see themselves.
    """
    if link.file_id:
        f = link.file
        return (
            f is not None
            and f.deleted_at is None
            and not f.is_quarantined
            and not f.is_frozen
            and f.status == File.Status.READY
        )
    if link.folder_id:
        fo = link.folder
        return fo is not None and fo.deleted_at is None
    return False


class FileShareView(APIView):
    """POST /storage/files/<id>/share — create a public link for one's own file."""

    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        try:
            file = File.objects.get(pk=file_id, owner=request.user, deleted_at__isnull=True)
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Don't mint a link for a file that can't be served publicly anyway
        # (quarantined, frozen, or still uploading/processing).
        if file.is_quarantined or file.is_frozen or file.status != File.Status.READY:
            return Response(
                {"detail": "File is not available to share.", "code": "file_not_ready"},
                status=status.HTTP_409_CONFLICT,
            )

        password = request.data.get("password") or ""
        if password and request.user.tier == request.user.Tier.FREE:
            return Response(
                {"detail": "Password-protected links are a paid-tier feature.", "code": "paid_only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Validate expiry up front: a raw client string reaches the DB layer
        # otherwise (500 on garbage) and a naive datetime is timezone-ambiguous
        # against the aware `timezone.now()` used by `is_expired`.
        expires_raw = request.data.get("expires_at")
        expires_at = None
        if expires_raw not in (None, ""):
            try:
                expires_at = drf_serializers.DateTimeField().to_internal_value(expires_raw)
            except drf_serializers.ValidationError:
                return Response(
                    {"detail": "Invalid expires_at.", "code": "invalid_expires_at"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        link = ShareLink.objects.create(
            owner=request.user,
            file=file,
            password_hash=make_password(password) if password else "",
            expires_at=expires_at,
        )
        from apps.analytics.track import track
        track("share_created", user=request.user, has_password=bool(password))
        return Response(ShareLinkSerializer(link).data, status=status.HTTP_201_CREATED)


class ShareListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ShareLink.objects.filter(owner=request.user, revoked=False).order_by("-created_at")
        return Response(ShareLinkSerializer(qs, many=True).data)


class ShareRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, share_id):
        try:
            link = ShareLink.objects.get(pk=share_id, owner=request.user)
        except ShareLink.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        link.revoked = True
        link.save(update_fields=["revoked", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicShareView(APIView):
    """GET /public/share/<token> — resolve a share (no auth; the token is the key)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get_throttles(self):
        # Throttle only password-unlock attempts (POST), not public resolves (GET).
        from rest_framework.throttling import ScopedRateThrottle
        if getattr(self, "request", None) and self.request.method == "POST":
            self.throttle_scope = "share_unlock"
            return [ScopedRateThrottle()]
        return []

    def get(self, request, token):
        link = self._get_active(token)
        if link is None:
            return self._gone_or_missing(token)
        if link.has_password:
            return Response({"locked": True, "name": self._name(link)})
        return Response(self._payload(link))

    def post(self, request, token):
        """Unlock a password-protected share."""
        link = self._get_active(token)
        if link is None:
            return self._gone_or_missing(token)
        if not link.has_password:
            return Response(self._payload(link))
        if not check_password(request.data.get("password") or "", link.password_hash):
            return Response({"detail": "Incorrect password."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(self._payload(link))

    # helpers
    def _get_active(self, token):
        link = ShareLink.objects.filter(token=token).select_related("file", "folder", "owner").first()
        if link is None or not link.is_active or not _target_available(link):
            return None
        return link

    def _gone_or_missing(self, token):
        exists = ShareLink.objects.filter(token=token).exists()
        return Response(
            {"detail": "This link has expired or been revoked." if exists else "Not found."},
            status=status.HTTP_410_GONE if exists else status.HTTP_404_NOT_FOUND,
        )

    def _name(self, link):
        return link.file.name if link.file_id else (link.folder.name if link.folder_id else "")

    def _payload(self, link):
        data = {"name": self._name(link), "locked": False}
        if link.file_id and link.file.storage_object_id:
            # Point at the public, token-authorized download route. It streams the
            # bytes in local mode and redirects to a presigned URL in R2 mode, so
            # a recipient can download without an account in either deployment.
            data.update({
                "kind": link.file.kind,
                "size_bytes": link.file.size_bytes,
                "download_url": f"/api/v1/public/share/{link.token}/download",
            })
        return data


class PublicShareDownloadView(APIView):
    """GET /public/share/<token>/download — stream a shared file's bytes (no account).

    Works in local mode (streams from disk, Range-aware) and R2 mode (redirects
    to a presigned URL). Password-protected links require the password as a
    ``?password=`` query param (or ``X-Share-Password`` header) — the token alone
    must not bypass the gate.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get_throttles(self):
        # A password can be supplied as `?password=` / `X-Share-Password`, so this
        # endpoint is itself a password-unlock surface — throttle those attempts
        # under the same scope as the POST unlock, or the gate is brute-forceable.
        req = getattr(self, "request", None)
        if req is not None and (
            req.query_params.get("password") or req.headers.get("X-Share-Password")
        ):
            self.throttle_scope = "share_unlock"
            return [ScopedRateThrottle()]
        return []

    def get(self, request, token):
        link = ShareLink.objects.filter(token=token).select_related("file").first()
        if link is None or not link.is_active or not _target_available(link):
            exists = ShareLink.objects.filter(token=token).exists()
            return Response(
                {"detail": "This link has expired or been revoked." if exists else "Not found."},
                status=status.HTTP_410_GONE if exists else status.HTTP_404_NOT_FOUND,
            )
        if not (link.file_id and link.file.storage_object_id):
            return Response({"detail": "Nothing to download."}, status=status.HTTP_404_NOT_FOUND)
        if link.has_password:
            supplied = request.query_params.get("password") or request.headers.get("X-Share-Password", "")
            if not check_password(supplied, link.password_hash):
                return Response({"detail": "Incorrect password."}, status=status.HTTP_401_UNAUTHORIZED)

        obj = link.file.storage_object
        storage = get_storage_service()
        # Local mode: stream from disk (Range-aware) so no auth is needed.
        if hasattr(storage, "local_path"):
            import mimetypes

            path = storage.local_path(region=obj.region, object_key=obj.object_key)
            if not path.exists():
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
            from apps.storage.views import _ranged_file_response

            ctype = mimetypes.guess_type(link.file.name)[0] or "application/octet-stream"
            return _ranged_file_response(request, path, ctype)
        # R2 mode: the presigned URL is itself anonymously fetchable.
        from django.shortcuts import redirect

        return redirect(storage.presign_download(region=obj.region, object_key=obj.object_key))

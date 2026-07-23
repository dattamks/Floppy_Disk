"""
Sharing API: owner-managed share links + a public token resolver.

Password protection is a paid-tier feature (PRD 5.4). The public resolver needs
no auth — the token is the capability.
"""
from django.contrib.auth.hashers import check_password, make_password
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.storage.models import File
from apps.storage.services.base import get_storage_service

from .models import ShareLink
from .serializers import ShareLinkSerializer


class FileShareView(APIView):
    """POST /storage/files/<id>/share — create a public link for one's own file."""

    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        try:
            file = File.objects.get(pk=file_id, owner=request.user, deleted_at__isnull=True)
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        password = request.data.get("password") or ""
        if password and request.user.tier == request.user.Tier.FREE:
            return Response(
                {"detail": "Password-protected links are a paid-tier feature.", "code": "paid_only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        link = ShareLink.objects.create(
            owner=request.user,
            file=file,
            password_hash=make_password(password) if password else "",
            expires_at=request.data.get("expires_at") or None,
        )
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
        if link is None or not link.is_active:
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
            obj = link.file.storage_object
            data.update({
                "kind": link.file.kind,
                "size_bytes": link.file.size_bytes,
                "download_url": get_storage_service().presign_download(
                    region=obj.region, object_key=obj.object_key
                ),
            })
        return data

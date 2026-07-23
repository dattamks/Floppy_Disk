"""Account management: delete, export, consent (DPDPA, PRD 5.11)."""
from django.contrib.auth import logout as django_logout
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .compliance import build_export
from .models import ConsentLog


class AccountDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Soft-delete immediately; hard-delete (cascade) runs 30 days later."""
        user = request.user
        user.mark_deleted()
        django_logout(request)
        return Response({"status": "deleted", "hard_delete_after_days": 30})


class DataExportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Kick off (dev: synchronous) a data export and return an expiring link."""
        export, url = build_export(request.user)
        return Response({
            "download_url": url,
            "size_bytes": export.size_bytes,
            "expires_at": export.expires_at,
        }, status=status.HTTP_201_CREATED)


class ConsentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        version = request.data.get("version")
        if not version:
            return Response({"detail": "version is required."}, status=status.HTTP_400_BAD_REQUEST)
        ConsentLog.objects.create(
            user=request.user, policy=request.data.get("policy", "tos"), version=version,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

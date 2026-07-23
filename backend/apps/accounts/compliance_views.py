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


class AccountSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    FIELDS = ("auto_backup_enabled", "backup_wifi_only")

    def get(self, request):
        u = request.user
        return Response({f: getattr(u, f) for f in self.FIELDS})

    def patch(self, request):
        u = request.user
        changed = []
        for f in self.FIELDS:
            if f in request.data:
                setattr(u, f, bool(request.data[f]))
                changed.append(f)
        if changed:
            u.save(update_fields=[*changed, "updated_at"])
        return Response({f: getattr(u, f) for f in self.FIELDS})


class ApiKeyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import ApiKey
        keys = ApiKey.objects.filter(user=request.user, revoked=False).order_by("-created_at")
        return Response([
            {"id": str(k.id), "name": k.name, "prefix": k.prefix,
             "last_used_at": k.last_used_at, "created_at": k.created_at}
            for k in keys
        ])

    def post(self, request):
        from .models import ApiKey
        key, token = ApiKey.create_for(request.user, name=request.data.get("name", ""))
        # The full token is returned exactly once.
        return Response({"id": str(key.id), "name": key.name, "prefix": key.prefix, "key": token},
                        status=status.HTTP_201_CREATED)


class ApiKeyRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, key_id):
        from .models import ApiKey
        updated = ApiKey.objects.filter(pk=key_id, user=request.user, revoked=False).update(revoked=True)
        if not updated:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

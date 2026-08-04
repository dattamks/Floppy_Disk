"""Account management: delete, export, consent (DPDPA, PRD 5.11)."""
from django.contrib.auth import logout as django_logout
from django.contrib.sessions.models import Session
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .compliance import build_export
from .models import ConsentLog


class AvatarView(APIView):
    """Set or clear the profile picture (a small, client-resized image data URL)."""

    permission_classes = [IsAuthenticated]
    MAX_LEN = 300 * 1024  # ~300KB data URL; the client resizes before sending
    # Only raster image types - SVG can carry markup, and other formats won't
    # render in an <img>. The web client always re-encodes to JPEG, so this
    # allowlist mainly guards direct API callers.
    ALLOWED_TYPES = ("image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp")

    def patch(self, request):
        data_url = str(request.data.get("avatar") or "")
        mime = data_url[5:].split(";", 1)[0].split(",", 1)[0].lower() if data_url.startswith("data:") else ""
        if mime not in self.ALLOWED_TYPES:
            return Response({"detail": "Avatar must be a PNG, JPEG, GIF, or WebP image."},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(data_url) > self.MAX_LEN:
            return Response({"detail": "Image is too large. Please choose a smaller one."},
                            status=status.HTTP_400_BAD_REQUEST)
        request.user.avatar_url = data_url
        request.user.save(update_fields=["avatar_url", "updated_at"])
        return Response({"avatar_url": data_url})

    def delete(self, request):
        request.user.avatar_url = ""
        request.user.save(update_fields=["avatar_url", "updated_at"])
        return Response({"avatar_url": ""})


class SignOutOtherSessionsView(APIView):
    """Revoke every OTHER logged-in session for this user, keeping the current one.

    Django's DB session store isn't indexed by user, so we scan sessions and drop
    the ones whose decoded `_auth_user_id` matches - fine at self-host scale.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.session.session_key
        uid = str(request.user.id)
        revoked = 0
        for s in Session.objects.all().iterator():
            if s.session_key == current:
                continue
            try:
                data = s.get_decoded()
            except Exception:  # noqa: BLE001 - a corrupt/expired session row is not ours to trust
                continue
            if str(data.get("_auth_user_id") or "") == uid:
                s.delete()
                revoked += 1
        return Response({"revoked": revoked})


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


def _as_bool(v) -> bool:
    """Parse a client-supplied boolean.

    `bool("false")` / `bool("0")` are both True, so form-encoded (or stringy
    JSON) values silently flip a flag the wrong way - e.g. disabling
    backup_wifi_only would instead enable it. Treat the usual false-y strings as
    False and only real truthy values as True.
    """
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("1", "true", "yes", "on")
    if v is None:
        return False
    return bool(v)


class AccountSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    BOOL_FIELDS = ("auto_backup_enabled", "backup_wifi_only", "two_factor_enabled")
    STRING_FIELDS = ("display_name", "language")
    FIELDS = STRING_FIELDS + BOOL_FIELDS

    def get(self, request):
        u = request.user
        return Response({f: getattr(u, f) for f in self.FIELDS})

    def patch(self, request):
        u = request.user
        changed = []
        for f in self.BOOL_FIELDS:
            if f in request.data:
                setattr(u, f, _as_bool(request.data[f]))
                changed.append(f)
        for f in self.STRING_FIELDS:
            if f in request.data:
                setattr(u, f, str(request.data[f]).strip()[:120])
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
            {"id": str(k.id), "name": k.name, "prefix": k.prefix, "scopes": k.scopes,
             "root_folder": str(k.root_folder_id) if k.root_folder_id else None,
             "last_used_at": k.last_used_at, "created_at": k.created_at}
            for k in keys
        ])

    def post(self, request):
        from apps.storage.models import Folder

        from .models import ApiKey
        # Least-privilege: `read_only: true` (or `scopes: "read"`) mints a key that
        # can fetch but not mutate. Defaults to full read+write.
        if request.data.get("read_only"):
            scopes = "read"
        else:
            scopes = request.data.get("scopes") or "read,write"
        # Optional folder scope: confine the key to one folder's subtree. Must be
        # a live folder the caller owns (never another user's).
        root_folder = None
        root_folder_id = request.data.get("root_folder") or None
        if root_folder_id:
            root_folder = Folder.objects.filter(
                pk=root_folder_id, owner=request.user, deleted_at__isnull=True
            ).first()
            if root_folder is None:
                return Response({"detail": "Folder not found."}, status=status.HTTP_400_BAD_REQUEST)
        key, token = ApiKey.create_for(request.user, name=request.data.get("name", ""), scopes=scopes)
        if root_folder is not None:
            key.root_folder = root_folder
            key.save(update_fields=["root_folder"])
        # The full token is returned exactly once.
        return Response({"id": str(key.id), "name": key.name, "prefix": key.prefix,
                         "scopes": key.scopes,
                         "root_folder": str(key.root_folder_id) if key.root_folder_id else None,
                         "key": token},
                        status=status.HTTP_201_CREATED)


class ApiKeyRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, key_id):
        from .models import ApiKey
        updated = ApiKey.objects.filter(pk=key_id, user=request.user, revoked=False).update(revoked=True)
        if not updated:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

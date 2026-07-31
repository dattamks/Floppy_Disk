"""Custom DRF permissions."""
from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Allow only the instance Owner - the first registered user or a superuser.

    Gates instance-wide admin settings (e.g. storage configuration). Deliberately
    session-only in spirit: it checks the authenticated user's owner status, so an
    API/MCP key belonging to a non-owner is refused like any other non-owner.
    """

    message = "Only the instance owner can do this."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.is_owner_effective)

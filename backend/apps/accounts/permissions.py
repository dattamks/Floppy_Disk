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


class IsSessionAuthenticated(BasePermission):
    """Require an interactive browser session, not an API key / bearer token.

    Instance-admin surfaces (storage configuration - credentials AND the budget
    cap) must never be driven by an API key or MCP, even one belonging to the
    owner. ApiKeyAuthentication puts the ApiKey on request.auth; a session puts
    None there, so we refuse any request that carries a key.
    """

    message = "This action requires an interactive owner session, not an API key."

    def has_permission(self, request, view):
        from .models import ApiKey

        return not isinstance(getattr(request, "auth", None), ApiKey)

"""Bearer API-key authentication for programmatic clients (MCP / integrations)."""
from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import ApiKey


class ApiKeyAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith(self.keyword + " "):
            return None  # fall through to other authenticators (e.g. session)
        token = header[len(self.keyword) + 1:].strip()
        if not token:
            return None
        try:
            key = ApiKey.objects.select_related("user").get(
                key_hash=ApiKey.hash_token(token), revoked=False
            )
        except ApiKey.DoesNotExist:
            raise exceptions.AuthenticationFailed("Invalid API key.")
        if not key.user.is_active:
            raise exceptions.AuthenticationFailed("Account is inactive.")
        ApiKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
        return (key.user, key)  # DRF sets request.user; no CSRF for Bearer auth

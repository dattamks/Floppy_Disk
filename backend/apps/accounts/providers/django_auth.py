"""
DjangoAuthProvider — Phase 1 email/password implementation of AuthProvider.

Uses Django's auth (password hashing, tokens) under the hood. Verification and
reset use Django's signed token generators; email delivery goes through the
configured EMAIL_BACKEND (console in dev, SES in prod).
"""
from __future__ import annotations

from django.contrib.auth import authenticate as dj_authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .base import AuthProvider, AuthResult

User = get_user_model()


class DjangoAuthProvider(AuthProvider):
    def register(self, *, email: str, password: str, **profile) -> AuthResult:
        user = User.objects.create_user(email=email, password=password, **profile)
        self.send_email_verification(user_id=str(user.pk))
        return AuthResult(user_id=str(user.pk), email=user.email, is_new=True)

    def authenticate(self, *, email: str, password: str) -> AuthResult | None:
        user = dj_authenticate(username=email.lower(), password=password)
        if user is None:
            return None
        return AuthResult(user_id=str(user.pk), email=user.email)

    def send_email_verification(self, *, user_id: str) -> None:
        # TODO(storage-slice): render + send verification email via Celery/SES.
        # Token generation shown so the flow is concrete; delivery is wired next.
        user = User.objects.get(pk=user_id)
        _uid = urlsafe_base64_encode(force_bytes(user.pk))
        _token = default_token_generator.make_token(user)
        # send_verification_email.delay(user.email, _uid, _token)

    def verify_email(self, *, token: str) -> bool:
        try:
            uidb64, raw_token = token.split(":", 1)
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (ValueError, User.DoesNotExist):
            return False
        if default_token_generator.check_token(user, raw_token):
            user.email_verified = True
            user.save(update_fields=["email_verified", "updated_at"])
            return True
        return False

    def start_password_reset(self, *, email: str) -> None:
        try:
            user = User.objects.get(email=email.lower())
        except User.DoesNotExist:
            return  # do not reveal account existence
        _uid = urlsafe_base64_encode(force_bytes(user.pk))
        _token = default_token_generator.make_token(user)
        # send_password_reset_email.delay(user.email, _uid, _token)

    def confirm_password_reset(self, *, token: str, new_password: str) -> bool:
        try:
            uidb64, raw_token = token.split(":", 1)
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (ValueError, User.DoesNotExist):
            return False
        if default_token_generator.check_token(user, raw_token):
            user.set_password(new_password)
            user.save(update_fields=["password", "updated_at"])
            return True
        return False

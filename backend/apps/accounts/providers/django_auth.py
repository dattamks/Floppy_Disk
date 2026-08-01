"""
DjangoAuthProvider - Phase 1 email/password implementation of AuthProvider.

Uses Django's auth (password hashing, tokens) under the hood. Verification and
reset use Django's signed token generators; email delivery goes through the
configured EMAIL_BACKEND (console in dev, SES in prod).
"""
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import authenticate as dj_authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .base import AuthProvider, AuthResult

User = get_user_model()


class EmailVerifyTokenGenerator(PasswordResetTokenGenerator):
    """Verification token independent of last_login/password.

    Registration auto-logs-in the user, which would invalidate a
    default_token_generator token (it hashes last_login). Hashing
    ``email_verified`` instead makes the token stable until it is used
    (verifying flips the flag, invalidating any older token).
    """

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.email}{user.email_verified}{timestamp}"


email_verify_token = EmailVerifyTokenGenerator()


def _send_link_email(user, *, subject, intro, path, token_generator=default_token_generator):
    """Compose a `uidb64:token` link and email it via the configured backend."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)
    base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
    link = f"{base}{path}?token={uid}:{token}"
    body = f"{intro}\n\n{link}\n\nIf you didn't request this, you can ignore this email."
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)


class DjangoAuthProvider(AuthProvider):
    def register(self, *, email: str, password: str, **profile) -> AuthResult:
        # The very first account to register becomes the instance Owner (the
        # self-host admin who can configure storage etc.). Done atomically so two
        # simultaneous first signups can't both claim it.
        with transaction.atomic():
            first_user = not User.objects.exists()
            user = User.objects.create_user(
                email=email, password=password, is_owner=first_user, **profile
            )
        self.send_email_verification(user_id=str(user.pk))
        return AuthResult(user_id=str(user.pk), email=user.email, is_new=True)

    def authenticate(self, *, email: str, password: str) -> AuthResult | None:
        user = dj_authenticate(username=email.lower(), password=password)
        if user is None:
            return None
        return AuthResult(user_id=str(user.pk), email=user.email)

    def send_email_verification(self, *, user_id: str) -> None:
        user = User.objects.get(pk=user_id)
        _send_link_email(
            user,
            subject="Verify your Floppy Disk email",
            intro="Welcome to Floppy Disk! Confirm your email address to finish setting up your account:",
            path="/verify-email",
            token_generator=email_verify_token,
        )

    def verify_email(self, *, token: str) -> bool:
        try:
            uidb64, raw_token = token.split(":", 1)
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (ValueError, User.DoesNotExist):
            return False
        if email_verify_token.check_token(user, raw_token):
            user.email_verified = True
            user.save(update_fields=["email_verified", "updated_at"])
            return True
        return False

    def start_password_reset(self, *, email: str) -> None:
        try:
            user = User.objects.get(email=email.lower())
        except User.DoesNotExist:
            return  # do not reveal account existence (no email sent)
        _send_link_email(
            user,
            subject="Reset your Floppy Disk password",
            intro="We received a request to reset your password. Use the link below to choose a new one:",
            path="/reset-password",
        )

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

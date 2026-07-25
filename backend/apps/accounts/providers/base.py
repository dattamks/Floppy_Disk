"""
AuthProvider abstraction.

Phase 1 is DjangoAuthProvider (email/password). Phase 2 swaps in a
CognitoAuthProvider (phone+OTP, social) without touching callers — they
depend only on this interface. Selected via settings.AUTH_PROVIDER.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AuthResult:
    user_id: str
    email: str
    is_new: bool = False


class AuthProvider(ABC):
    """Contract every auth backend must satisfy."""

    @abstractmethod
    def register(self, *, email: str, password: str, **profile) -> AuthResult:
        """Create an account. Raises on duplicate/invalid input."""

    @abstractmethod
    def authenticate(self, *, email: str, password: str) -> AuthResult | None:
        """Return an AuthResult on success, None on bad credentials."""

    @abstractmethod
    def send_email_verification(self, *, user_id: str) -> None:
        """Dispatch an email-verification link/token."""

    @abstractmethod
    def verify_email(self, *, token: str) -> bool:
        """Confirm an email-verification token."""

    @abstractmethod
    def start_password_reset(self, *, email: str) -> None:
        """Begin a password-reset flow (emailed link)."""

    @abstractmethod
    def confirm_password_reset(self, *, token: str, new_password: str) -> bool:
        """Complete a password reset."""

    # --- Phase 2 (phone/OTP) — declared now, implemented with Cognito later ---
    def start_phone_otp(self, *, phone: str) -> None:  # pragma: no cover
        raise NotImplementedError("Phone/OTP is a Phase 2 capability.")

    def verify_phone_otp(self, *, phone: str, code: str) -> AuthResult | None:  # pragma: no cover
        raise NotImplementedError("Phone/OTP is a Phase 2 capability.")


def get_auth_provider() -> AuthProvider:
    """Instantiate the configured AuthProvider (settings.AUTH_PROVIDER)."""
    from django.conf import settings
    from django.utils.module_loading import import_string

    return import_string(settings.AUTH_PROVIDER)()

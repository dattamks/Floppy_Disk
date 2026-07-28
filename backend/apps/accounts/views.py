"""
Auth API views (Phase 1: email/password).

Views depend only on the AuthProvider abstraction for credential logic, then
establish a Django session so DRF SessionAuthentication works for the SPA
(served same-origin via the Vite dev proxy).
"""
from django.contrib.auth import get_user_model
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .providers.base import get_auth_provider
from .serializers import (
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)

User = get_user_model()
MODEL_BACKEND = "django.contrib.auth.backends.ModelBackend"


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provider = get_auth_provider()
        result = provider.register(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            display_name=serializer.validated_data.get("display_name", ""),
            date_of_birth=serializer.validated_data["date_of_birth"],
        )
        user = User.objects.get(pk=result.user_id)
        # Single storage tier (no billing): grant the standard allowance.
        from django.conf import settings
        user.quota_bytes = settings.DEFAULT_QUOTA_BYTES
        user.save(update_fields=["quota_bytes", "updated_at"])
        django_login(request, user, backend=MODEL_BACKEND)
        from apps.analytics.track import track
        track("signup", user=user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provider = get_auth_provider()
        result = provider.authenticate(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if result is None:
            return Response(
                {"detail": "Incorrect email or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = User.objects.get(pk=result.user_id)
        # Enforce account status: suspended/deleted accounts must not be able to
        # sign in even with correct credentials (previously only is_active was
        # checked, and nothing maps status onto is_active).
        if user.status in (User.Status.SUSPENDED, User.Status.DELETED) or not user.is_active:
            return Response(
                {"detail": "This account is not active."},
                status=status.HTTP_403_FORBIDDEN,
            )
        django_login(request, user, backend=MODEL_BACKEND)
        # Record login time for dormancy detection (Django's signal updates the
        # inherited last_login, not this custom field, which was never written).
        from django.utils import timezone
        User.objects.filter(pk=user.pk).update(last_login_at=timezone.now())
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordChangeView(APIView):
    """Change the password of the logged-in user (requires the current one)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.contrib.auth import update_session_auth_hash
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        current = request.data.get("current_password") or ""
        new = request.data.get("new_password") or ""
        if not request.user.check_password(current):
            return Response({"detail": "Current password is incorrect."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new, user=request.user)
        except DjangoValidationError as exc:
            return Response({"detail": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new)
        request.user.save(update_fields=["password", "updated_at"])
        update_session_auth_hash(request, request.user)  # keep the user logged in
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfView(APIView):
    """Frontend calls this once on load to obtain the csrftoken cookie."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        get_auth_provider().start_password_reset(email=serializer.validated_data["email"])
        # Always 204 — never reveal whether the account exists.
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"  # token-guessing must be rate-limited too

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ok = get_auth_provider().confirm_password_reset(
            token=serializer.validated_data["token"],
            new_password=serializer.validated_data["new_password"],
        )
        if not ok:
            return Response({"detail": "Invalid or expired token."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "verify_email"  # rate-limit token guessing

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ok = get_auth_provider().verify_email(token=serializer.validated_data["token"])
        if not ok:
            return Response({"detail": "Invalid or expired token."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Email verified."}, status=status.HTTP_200_OK)


class ResendVerificationView(APIView):
    """Re-send the email-verification link to the logged-in user."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "verify_email"

    def post(self, request):
        if request.user.email_verified:
            return Response({"detail": "Email is already verified."},
                            status=status.HTTP_400_BAD_REQUEST)
        get_auth_provider().send_email_verification(user_id=str(request.user.pk))
        # 202: we dispatched the email; the user completes it via the link.
        return Response({"detail": "Verification email sent."}, status=status.HTTP_202_ACCEPTED)

"""Auth API routes (mounted at /api/v1/auth/)."""
from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("register", views.RegisterView.as_view(), name="register"),
    path("login", views.LoginView.as_view(), name="login"),
    path("logout", views.LogoutView.as_view(), name="logout"),
    path("me", views.MeView.as_view(), name="me"),
    path("csrf", views.CsrfView.as_view(), name="csrf"),
    path("password-reset", views.PasswordResetRequestView.as_view(), name="password_reset"),
    path("password-reset/confirm", views.PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("verify-email", views.VerifyEmailView.as_view(), name="verify_email"),
]

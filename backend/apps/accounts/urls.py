"""Auth API routes (mounted at /api/v1/auth/)."""
from django.urls import path

from . import compliance_views, views

app_name = "accounts"

urlpatterns = [
    path("register", views.RegisterView.as_view(), name="register"),
    path("login", views.LoginView.as_view(), name="login"),
    path("logout", views.LogoutView.as_view(), name="logout"),
    path("me", views.MeView.as_view(), name="me"),
    path("csrf", views.CsrfView.as_view(), name="csrf"),
    path("password-change", views.PasswordChangeView.as_view(), name="password_change"),
    path("password-reset", views.PasswordResetRequestView.as_view(), name="password_reset"),
    path("password-reset/confirm", views.PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("verify-email", views.VerifyEmailView.as_view(), name="verify_email"),
    path("verify-email/resend", views.ResendVerificationView.as_view(), name="verify_email_resend"),
    path("account/delete", compliance_views.AccountDeleteView.as_view(), name="account_delete"),
    path("account/export", compliance_views.DataExportView.as_view(), name="account_export"),
    path("account/consent", compliance_views.ConsentView.as_view(), name="account_consent"),
    path("account/settings", compliance_views.AccountSettingsView.as_view(), name="account_settings"),
    path("account/sessions/revoke-others", compliance_views.SignOutOtherSessionsView.as_view(),
         name="account_sessions_revoke_others"),
    path("api-keys", compliance_views.ApiKeyListCreateView.as_view(), name="api_keys"),
    path("api-keys/<uuid:key_id>", compliance_views.ApiKeyRevokeView.as_view(), name="api_key_revoke"),
]

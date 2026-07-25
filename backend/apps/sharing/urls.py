"""Sharing routes: owner-managed (under /api/v1/storage) + public resolver."""
from django.urls import path

from . import views

app_name = "sharing"

# Owner endpoints (mounted at /api/v1/storage/)
owner_urlpatterns = [
    path("files/<uuid:file_id>/share", views.FileShareView.as_view(), name="file_share"),
    path("shares", views.ShareListView.as_view(), name="share_list"),
    path("shares/<uuid:share_id>", views.ShareRevokeView.as_view(), name="share_revoke"),
]

# Public endpoint (mounted at /api/v1/public/)
public_urlpatterns = [
    path("share/<str:token>", views.PublicShareView.as_view(), name="public_share"),
    path("share/<str:token>/download", views.PublicShareDownloadView.as_view(), name="public_share_download"),
]

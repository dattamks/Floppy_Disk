"""Owner-only storage admin routes (mounted at /api/v1/admin/storage/)."""
from django.urls import path

from . import admin_views

app_name = "storage_admin"

urlpatterns = [
    path("", admin_views.StorageConfigView.as_view(), name="config"),
    path("test", admin_views.StorageTestView.as_view(), name="test"),
    path("migrate", admin_views.StorageMigrationView.as_view(), name="migrate"),
    path("migrate/pause", admin_views.StorageMigrationPauseView.as_view(), name="migrate_pause"),
]

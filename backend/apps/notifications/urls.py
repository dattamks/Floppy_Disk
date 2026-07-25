"""Notification routes (mounted at /api/v1/notifications/)."""
from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="list"),
    path("<uuid:notification_id>/read", views.NotificationReadView.as_view(), name="read"),
    path("read-all", views.NotificationReadAllView.as_view(), name="read_all"),
]

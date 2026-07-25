"""Moderation routes (mounted at /api/v1/moderation/)."""
from django.urls import path

from . import views

app_name = "moderation"

urlpatterns = [
    path("reports", views.ReportCreateView.as_view(), name="report_create"),
]

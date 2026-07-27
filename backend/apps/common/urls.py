"""Legal / compliance routes (mounted at /api/v1/legal/)."""
from django.urls import path

from . import legal_views

app_name = "legal"

urlpatterns = [
    path("", legal_views.LegalInfoView.as_view(), name="info"),
    path("grievance", legal_views.GrievanceCreateView.as_view(), name="grievance"),
]

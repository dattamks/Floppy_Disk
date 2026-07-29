"""Graph API routes (mounted at /api/v1/graph/)."""
from django.urls import path

from . import views

app_name = "graph"

urlpatterns = [
    path("", views.GraphView.as_view(), name="graph"),
    path("search", views.GraphSearchView.as_view(), name="graph_search"),
    path("rebuild", views.GraphRebuildView.as_view(), name="graph_rebuild"),
    path("related/<uuid:file_id>", views.GraphRelatedView.as_view(), name="graph_related"),
]

"""Tables API routes (mounted at /api/v1/tables/)."""
from django.urls import path

from . import views

app_name = "tables"

urlpatterns = [
    path("", views.TableListCreateView.as_view(), name="list"),
    path("<uuid:table_id>", views.TableDetailView.as_view(), name="detail"),
    path("<uuid:table_id>/fields", views.FieldListCreateView.as_view(), name="fields"),
    path("<uuid:table_id>/rows", views.RowListCreateView.as_view(), name="rows"),
    path("<uuid:table_id>/rows/bulk_delete", views.RowBulkDeleteView.as_view(), name="rows_bulk_delete"),
    path("fields/<uuid:field_id>", views.FieldDetailView.as_view(), name="field_detail"),
    path("rows/<uuid:row_id>", views.RowDetailView.as_view(), name="row_detail"),
    path("views/<uuid:view_id>", views.ViewDetailView.as_view(), name="view_detail"),
]

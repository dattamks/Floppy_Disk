"""Storage API routes (mounted at /api/v1/storage/)."""
from django.urls import path, re_path

from . import views

app_name = "storage"

urlpatterns = [
    path("usage", views.UsageView.as_view(), name="usage"),
    path("folders", views.FolderListCreateView.as_view(), name="folder_list"),
    path("folders/<uuid:folder_id>", views.FolderDetailView.as_view(), name="folder_detail"),
    path("files", views.FileListView.as_view(), name="file_list"),
    path("uploads", views.UploadInitiateView.as_view(), name="upload_initiate"),
    path("uploads/<uuid:file_id>/complete", views.UploadCompleteView.as_view(), name="upload_complete"),
    # dev-only blob store (object_key can contain '/')
    re_path(r"^_dev/blob/(?P<region>[\w-]+)/(?P<object_key>.+)$", views.DevBlobView.as_view(), name="dev_blob"),
]

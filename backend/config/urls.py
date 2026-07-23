from django.contrib import admin
from django.urls import include, path

from apps.common.health import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    # path("api/v1/storage/", include("apps.storage.urls")),
]

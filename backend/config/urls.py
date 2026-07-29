from django.contrib import admin
from django.urls import include, path

from apps.common.health import health
from apps.sharing.urls import owner_urlpatterns as sharing_owner
from apps.sharing.urls import public_urlpatterns as sharing_public

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/storage/", include("apps.storage.urls")),
    path("api/v1/storage/", include((sharing_owner, "sharing_owner"))),
    path("api/v1/public/", include((sharing_public, "sharing_public"))),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/graph/", include("apps.graph.urls")),
]

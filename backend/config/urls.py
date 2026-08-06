from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from apps.common.health import health
from apps.sharing.urls import owner_urlpatterns as sharing_owner
from apps.sharing.urls import public_urlpatterns as sharing_public

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/storage/", include("apps.storage.urls")),
    path("api/v1/admin/storage/", include("apps.storage.admin_urls")),
    path("api/v1/storage/", include((sharing_owner, "sharing_owner"))),
    path("api/v1/public/", include((sharing_public, "sharing_public"))),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/graph/", include("apps.graph.urls")),
    path("api/v1/tables/", include("apps.tables.urls")),
]

# Standalone (single-deployment): Django also serves the built SPA. This
# catch-all must stay last; WhiteNoise serves real static files (/assets/...)
# before requests reach it, so only client-side routes fall through to the app.
if getattr(settings, "SERVE_SPA", False):
    from apps.common.spa import spa_index

    urlpatterns += [re_path(r"^(?!api/|admin/|health/).*$", spa_index)]

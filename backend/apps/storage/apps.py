import os
import sys

from django.apps import AppConfig


class StorageConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.storage"

    def ready(self):
        # Register the storage system checks (local-storage persistence nudge).
        from . import checks  # noqa: F401

        # Log which storage backend is in use once, for an actual server process
        # (not migrate/collectstatic/tests), so operators see it in the boot log.
        argv = " ".join(sys.argv)
        is_server = any(cmd in argv for cmd in ("runserver", "gunicorn", "uvicorn", "daphne"))
        reloader_parent = (
            "runserver" in argv
            and os.environ.get("RUN_MAIN") != "true"
            and "--noreload" not in argv
        )
        if is_server and not reloader_parent:
            checks.log_storage_backend_at_boot()

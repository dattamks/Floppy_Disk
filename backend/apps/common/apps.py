import os
import sys
import threading

from django.apps import AppConfig
from django.conf import settings


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.common"

    def ready(self):
        self._maybe_start_maintenance_thread()

    def _maybe_start_maintenance_thread(self):
        """In standalone mode, run periodic maintenance in-process (no Celery beat).

        Gated so it only runs for an actual server process — never during
        migrate/collectstatic/tests/shell — and only once. Opt out with
        RUN_MAINTENANCE=0. The interval defaults to hourly; jobs are idempotent.
        """
        if not getattr(settings, "STANDALONE", False):
            return
        if os.environ.get("RUN_MAINTENANCE", "1") == "0":
            return
        argv = " ".join(sys.argv)
        # Only long-running server commands should schedule background work.
        if not any(cmd in argv for cmd in ("runserver", "gunicorn", "uvicorn", "daphne")):
            return
        # runserver's autoreloader imports twice; only the reloaded child serves.
        if "runserver" in argv and os.environ.get("RUN_MAIN") != "true" and "--noreload" not in argv:
            return
        if getattr(CommonConfig, "_maintenance_started", False):
            return
        CommonConfig._maintenance_started = True

        interval = int(os.environ.get("MAINTENANCE_INTERVAL_SECONDS", str(60 * 60)))

        def loop():
            import time

            from apps.common.maintenance import run_all

            while True:
                time.sleep(interval)
                try:
                    run_all()
                except Exception:  # noqa: BLE001 - never let the thread die
                    pass

        t = threading.Thread(target=loop, name="floppy-maintenance", daemon=True)
        t.start()

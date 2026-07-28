"""Celery application for Floppy Disk."""
import os

from celery import Celery

# Match the wsgi/asgi entrypoints: a worker/beat started in production without an
# explicit DJANGO_SETTINGS_MODULE must NOT silently fall back to dev settings
# (memory broker + TASK_ALWAYS_EAGER + DEBUG), which would make it consume no
# jobs. Dev/compose/tests set this env explicitly.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

app = Celery("floppydisk")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")

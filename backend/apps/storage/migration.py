"""Background engine for the owner-driven 'move my local files to R2' job.

Shares the same semantics as the ``migrate_storage_to_r2`` CLI command — walk the
content-addressed blobs, skip anything already in R2, stream each up — but writes
progress to a ``StorageMigration`` row the UI polls, and cooperatively pauses when
the owner asks. Idempotent and resumable: re-running continues where it stopped.
"""
from __future__ import annotations

import threading

from django.utils import timezone

from .models import StorageMigration, StorageObject
from .services.base import get_storage_service
from .services.local import LocalStorageService

# How often (in blobs processed) to flush progress + check for a pause request.
_FLUSH_EVERY = 3


def run_migration_job(job_id) -> None:
    """Execute the move synchronously, updating the StorageMigration row."""
    job = StorageMigration.objects.get(pk=job_id)
    dest = get_storage_service()
    if not (hasattr(dest, "upload_from_path") and hasattr(dest, "object_exists")):
        job.status = StorageMigration.Status.FAILED
        job.error = "Active storage backend is not R2 — configure R2 before migrating."
        job.finished_at = timezone.now()
        job.save()
        return

    source = LocalStorageService()  # reads DEV_STORAGE_DIR regardless of active backend
    qs = StorageObject.objects.filter(ref_count__gt=0).exclude(object_key="")

    job.total = qs.count()
    job.status = StorageMigration.Status.RUNNING
    job.started_at = timezone.now()
    job.error = ""
    job.save()

    processed = 0
    for obj in qs.iterator():
        # Cooperative pause: the owner set cancel_requested via the API.
        if processed % _FLUSH_EVERY == 0:
            job.refresh_from_db(fields=["cancel_requested"])
            if job.cancel_requested:
                job.status = StorageMigration.Status.PAUSED
                job.save()
                return

        src_path = source.local_path(region=obj.region, object_key=obj.object_key)
        try:
            if not src_path.exists():
                job.skipped += 1
            elif dest.object_exists(region=obj.region, object_key=obj.object_key):
                job.skipped += 1
            else:
                size = src_path.stat().st_size
                dest.upload_from_path(region=obj.region, object_key=obj.object_key, path=src_path)
                job.done += 1
                job.bytes_moved += size
                if job.delete_local and dest.object_exists(
                    region=obj.region, object_key=obj.object_key
                ):
                    src_path.unlink(missing_ok=True)
        except Exception as exc:  # noqa: BLE001 - record and keep going
            job.failed += 1
            job.error = f"{obj.object_key}: {exc}"

        processed += 1
        if processed % _FLUSH_EVERY == 0:
            job.save(update_fields=["done", "skipped", "failed", "bytes_moved", "error", "updated_at"])

    job.status = (
        StorageMigration.Status.DONE if job.failed == 0 else StorageMigration.Status.FAILED
    )
    job.finished_at = timezone.now()
    job.save()


def start_migration_job(job: StorageMigration) -> None:
    """Run the job in a daemon thread (standalone is single-process; Celery is
    eager here, so a task would block the request)."""
    job_id = job.pk

    def _run():
        import django

        django.setup()  # safe/no-op if already set up; ensures apps in the thread
        try:
            run_migration_job(job_id)
        except Exception:  # noqa: BLE001 - never let the thread crash silently
            try:
                m = StorageMigration.objects.get(pk=job_id)
                m.status = StorageMigration.Status.FAILED
                m.finished_at = timezone.now()
                m.save(update_fields=["status", "finished_at", "updated_at"])
            except Exception:  # noqa: BLE001
                pass

    threading.Thread(target=_run, name=f"floppy-storage-migrate-{job_id}", daemon=True).start()

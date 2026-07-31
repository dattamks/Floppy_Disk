"""Copy existing local-disk blobs up to Cloudflare R2.

When a self-host starts on local storage and later configures R2, files already
on disk stay on disk — new uploads go to R2, but old files would 404 on
download. Run this once after adding the R2 credentials to move everything over:

    python manage.py migrate_storage_to_r2
    # standalone container:
    docker compose -f docker-compose.standalone.yml exec floppy \\
        python manage.py migrate_storage_to_r2

It walks the content-addressed blobs (StorageObject) — so shared/duplicated
files are copied once, not per reference — reads each from the local directory,
and uploads it to the bucket its region maps to. It is **idempotent and
resumable**: a blob already present in R2 is skipped, so re-running after an
interruption just continues. Nothing local is deleted unless you pass
``--delete-local`` (and only after the upload is verified).
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.storage.models import StorageObject
from apps.storage.services.base import get_storage_service
from apps.storage.services.local import LocalStorageService


class Command(BaseCommand):
    help = "Migrate existing local-disk file blobs to the configured R2 bucket."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Report what would be uploaded without uploading anything.",
        )
        parser.add_argument(
            "--delete-local", action="store_true",
            help="Delete each local blob after its upload is verified (reclaims disk).",
        )
        parser.add_argument(
            "--region", default=None,
            help="Only migrate blobs in this residency region (default: all).",
        )

    def handle(self, *args, **options):
        dest = get_storage_service()
        # The destination must be R2 (or an S3-compatible backend that can accept
        # uploads and answer existence checks). If storage is still local, the R2
        # credentials aren't set — there's nothing to migrate *to*.
        if not (hasattr(dest, "upload_from_path") and hasattr(dest, "object_exists")):
            raise CommandError(
                "The active storage backend is not R2. Set R2_ENDPOINT_URL, "
                "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET (then this "
                "backend is auto-selected) before migrating.\n"
                f"Current STORAGE_SERVICE = {settings.STORAGE_SERVICE}"
            )

        source = LocalStorageService()  # reads DEV_STORAGE_DIR regardless of the active backend
        dry_run = options["dry_run"]
        delete_local = options["delete_local"]

        qs = StorageObject.objects.filter(ref_count__gt=0).exclude(object_key="")
        if options["region"]:
            qs = qs.filter(region=options["region"])
        total = qs.count()

        uploaded = skipped_existing = missing_local = failed = deleted = 0
        bytes_uploaded = 0
        self.stdout.write(f"Scanning {total} blob(s)…")

        for obj in qs.iterator():
            src_path = source.local_path(region=obj.region, object_key=obj.object_key)
            if not src_path.exists():
                # Referenced blob with no local file (already remote, or lost) —
                # skip rather than fail the whole run.
                missing_local += 1
                continue
            if dest.object_exists(region=obj.region, object_key=obj.object_key):
                skipped_existing += 1
                continue
            size = src_path.stat().st_size
            if dry_run:
                uploaded += 1
                bytes_uploaded += size
                self.stdout.write(f"  would upload {obj.object_key} ({size} bytes)")
                continue
            try:
                dest.upload_from_path(
                    region=obj.region, object_key=obj.object_key, path=src_path
                )
            except Exception as exc:  # noqa: BLE001 - report and keep going
                failed += 1
                self.stderr.write(self.style.WARNING(f"  FAILED {obj.object_key}: {exc}"))
                continue
            uploaded += 1
            bytes_uploaded += size
            if delete_local:
                # Verify the bytes really landed before removing the local copy.
                if dest.object_exists(region=obj.region, object_key=obj.object_key):
                    src_path.unlink(missing_ok=True)
                    deleted += 1
                else:
                    self.stderr.write(self.style.WARNING(
                        f"  kept local {obj.object_key}: not verified in R2 after upload"
                    ))

        verb = "Would upload" if dry_run else "Uploaded"
        mib = bytes_uploaded / (1024 * 1024)
        self.stdout.write(self.style.SUCCESS(
            f"{verb} {uploaded} blob(s), {mib:.1f} MiB. "
            f"Skipped {skipped_existing} already in R2, {missing_local} with no local file."
            + (f" Deleted {deleted} local copies." if delete_local and not dry_run else "")
            + (f" {failed} failed." if failed else "")
        ))
        if failed:
            raise CommandError(f"{failed} blob(s) failed to upload — re-run to retry them.")

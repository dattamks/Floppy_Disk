"""Owner-only storage administration API (drives the Settings → Storage UI).

Endpoints (all require the instance Owner):

  GET  /admin/storage            current config + local-file summary + job state
  PUT  /admin/storage            save backend/R2 creds (secret write-only, encrypted)
  POST /admin/storage/test       verify R2 creds/bucket reachability (before saving)
  POST /admin/storage/migrate    start the one-time local -> R2 move
  POST /admin/storage/migrate/pause   cooperatively pause a running move

Storage credentials are reachable only through this Owner-session-gated surface -
never via MCP or a regular API key.
"""
from __future__ import annotations

from django.db.models import Count, Sum
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsOwner, IsSessionAuthenticated

from .config import decrypt_secret, effective_backend, encrypt_secret, env_manages_storage
from .migration import start_migration_job
from .models import StorageConfig, StorageMigration, StorageObject


def _local_blob_summary() -> dict:
    agg = (
        StorageObject.objects.filter(ref_count__gt=0)
        .exclude(object_key="")
        .aggregate(count=Count("id"), bytes=Sum("size_bytes"))
    )
    return {"count": agg["count"] or 0, "bytes": agg["bytes"] or 0}


def _migration_dict(job: StorageMigration | None) -> dict | None:
    if job is None:
        return None
    return {
        "id": str(job.id),
        "status": job.status,
        "total": job.total,
        "done": job.done,
        "skipped": job.skipped,
        "failed": job.failed,
        "bytes_moved": job.bytes_moved,
        "delete_local": job.delete_local,
        "error": job.error,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


def _config_payload() -> dict:
    from .quota import instance_used_bytes, storage_total_bytes

    cfg = StorageConfig.load()
    latest = StorageMigration.objects.order_by("-created_at").first()
    used = instance_used_bytes()
    cap = storage_total_bytes()
    return {
        "backend": cfg.backend,
        "effective_backend": effective_backend(),
        "env_managed": env_manages_storage(),
        "setup_completed": cfg.setup_completed,
        "r2": {
            "endpoint_url": cfg.r2_endpoint_url,
            "access_key_id": cfg.r2_access_key_id,
            "bucket": cfg.r2_bucket,
            "secret_set": bool(cfg.r2_secret_ciphertext),
        },
        # Budget cap (R2) + overflow toggle, and current instance-wide usage so
        # the UI can flag when stored bytes already exceed a just-lowered cap.
        "r2_quota_bytes": cfg.r2_quota_bytes,
        "allow_overflow": cfg.allow_overflow,
        "used_bytes": used,
        "total_bytes": cap,
        "over_cap": used > cap,
        "local_blobs": _local_blob_summary(),
        "migration": _migration_dict(latest),
    }


class StorageConfigView(APIView):
    permission_classes = [IsAuthenticated, IsOwner, IsSessionAuthenticated]

    def get(self, request):
        return Response(_config_payload())

    def put(self, request):
        if env_manages_storage():
            return Response(
                {"detail": "Storage is configured by environment variables and can't be "
                           "changed here.", "code": "env_managed"},
                status=status.HTTP_409_CONFLICT,
            )
        cfg = StorageConfig.load()
        data = request.data or {}
        backend = data.get("backend", cfg.backend)
        if backend not in (StorageConfig.Backend.LOCAL, StorageConfig.Backend.R2):
            return Response({"detail": "Unknown backend."}, status=status.HTTP_400_BAD_REQUEST)

        # R2 budget cap + overflow toggle (independent of switching backends).
        # Lowering the cap below what's already stored is allowed - it's a budget
        # figure, not a wall - and flagged via over_cap in the response.
        if "r2_quota_bytes" in data:
            try:
                cap = int(data.get("r2_quota_bytes"))
            except (TypeError, ValueError):
                return Response({"detail": "r2_quota_bytes must be a whole number of bytes."},
                                status=status.HTTP_400_BAD_REQUEST)
            if cap <= 0:
                return Response({"detail": "Storage cap must be greater than zero."},
                                status=status.HTTP_400_BAD_REQUEST)
            cfg.r2_quota_bytes = cap
        if "allow_overflow" in data:
            cfg.allow_overflow = bool(data.get("allow_overflow"))

        if backend == StorageConfig.Backend.R2:
            endpoint = str(data.get("endpoint_url", cfg.r2_endpoint_url) or "").strip()
            access = str(data.get("access_key_id", cfg.r2_access_key_id) or "").strip()
            bucket = str(data.get("bucket", cfg.r2_bucket) or "").strip()
            secret_in = data.get("secret_access_key", None)
            # A new secret is optional on edit (keep the stored one if omitted).
            has_secret = bool(secret_in) or bool(cfg.r2_secret_ciphertext)
            missing = [n for n, v in (("endpoint", endpoint), ("access key", access),
                                      ("bucket", bucket)) if not v]
            if missing or not has_secret:
                if not has_secret:
                    missing.append("secret key")
                return Response(
                    {"detail": f"Missing R2 {', '.join(missing)}.", "code": "incomplete"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cfg.r2_endpoint_url = endpoint
            cfg.r2_access_key_id = access
            cfg.r2_bucket = bucket
            if secret_in:
                cfg.r2_secret_ciphertext = encrypt_secret(str(secret_in))

        cfg.backend = backend
        if "setup_completed" in data:
            cfg.setup_completed = bool(data.get("setup_completed"))
        cfg.updated_by = request.user
        cfg.save()
        return Response(_config_payload())


class StorageTestView(APIView):
    """Verify R2 credentials/bucket reachability. Uses creds from the request body
    when provided (so 'Test' works before saving), else the stored config."""

    permission_classes = [IsAuthenticated, IsOwner, IsSessionAuthenticated]

    def post(self, request):
        from .services.r2 import R2StorageService

        data = request.data or {}
        cfg = StorageConfig.load()
        secret = data.get("secret_access_key")
        if not secret and cfg.r2_secret_ciphertext:
            secret = decrypt_secret(cfg.r2_secret_ciphertext)
        svc = R2StorageService(
            endpoint_url=str(data.get("endpoint_url", cfg.r2_endpoint_url) or ""),
            access_key_id=str(data.get("access_key_id", cfg.r2_access_key_id) or ""),
            secret_access_key=str(secret or ""),
            bucket=str(data.get("bucket", cfg.r2_bucket) or ""),
            region_buckets={},
        )
        try:
            svc.check_connection()
        except Exception as exc:  # noqa: BLE001 - surface a friendly reason
            return Response({"ok": False, "error": _friendly_error(exc)})
        return Response({"ok": True})


class StorageMigrationView(APIView):
    permission_classes = [IsAuthenticated, IsOwner, IsSessionAuthenticated]

    def get(self, request):
        job = StorageMigration.objects.order_by("-created_at").first()
        return Response(_migration_dict(job) or {"status": "none"})

    def post(self, request):
        if effective_backend() != "r2":
            return Response(
                {"detail": "Connect R2 before moving files.", "code": "not_r2"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        active = StorageMigration.objects.filter(
            status__in=[StorageMigration.Status.PENDING, StorageMigration.Status.RUNNING]
        ).first()
        if active:
            return Response(_migration_dict(active), status=status.HTTP_200_OK)
        job = StorageMigration.objects.create(
            delete_local=bool((request.data or {}).get("delete_local", False)),
            created_by=request.user,
        )
        start_migration_job(job)
        return Response(_migration_dict(job), status=status.HTTP_202_ACCEPTED)


class StorageMigrationPauseView(APIView):
    permission_classes = [IsAuthenticated, IsOwner, IsSessionAuthenticated]

    def post(self, request):
        job = StorageMigration.objects.filter(
            status__in=[StorageMigration.Status.PENDING, StorageMigration.Status.RUNNING]
        ).order_by("-created_at").first()
        if job is None:
            return Response({"detail": "No active migration."}, status=status.HTTP_404_NOT_FOUND)
        job.cancel_requested = True
        job.save(update_fields=["cancel_requested", "updated_at"])
        return Response(_migration_dict(job))


def _friendly_error(exc: Exception) -> str:
    text = str(exc)
    low = text.lower()
    if "credential" in low or "signature" in low or "accessdenied" in low or "403" in low:
        return "Access denied - check the access key and secret."
    if "nosuchbucket" in low or "404" in low or "not found" in low:
        return "Bucket not found - check the bucket name and endpoint."
    if "endpoint" in low or "connect" in low or "resolve" in low or "timed out" in low:
        return "Could not reach the endpoint - check the account endpoint URL."
    return text or "Connection failed."

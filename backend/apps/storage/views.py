"""
Storage API: folders, files, and the reserve-then-commit upload flow.

Upload flow (presigned direct-to-storage):
  1. POST uploads/          -> reserve quota, create pending File, return presign
  2. PUT  <presigned url>   -> client uploads bytes (dev: LocalStorageService blob)
  3. POST uploads/<id>/complete -> dedup StorageObject, commit reservation, File ready
"""
from django.conf import settings
from django.db.models import F
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

import hashlib

from django.db import transaction

from .lifecycle import _release_object, purge_file, purge_folder
from .models import File, Folder, StorageObject, StorageReservation
from .naming import unique_name
from .quota import FileTooLarge, QuotaExceeded, available_bytes, commit, reserve
from .serializers import (
    FileSerializer,
    FolderCreateSerializer,
    FolderSerializer,
    UploadInitiateSerializer,
)
from .services.base import get_storage_service


def _object_key(user_id, file_id) -> str:
    return f"{user_id}/{file_id}"


def _ranged_file_response(request, path, content_type):
    """Serve a file from disk honoring the HTTP Range header (206 partial)."""
    import re

    file_size = path.stat().st_size
    range_header = request.headers.get("Range", "")
    # Accept both `bytes=start-[end]` and the suffix form `bytes=-N` (last N bytes).
    m = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if m and (m.group(1) or m.group(2)):
        if m.group(1) == "":
            # Suffix range: the final N bytes.
            n = int(m.group(2))
            start = max(0, file_size - n) if n else file_size
            end = file_size - 1
        else:
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else file_size - 1
            end = min(end, file_size - 1)
        # Unsatisfiable (start past EOF, empty file, or zero-length suffix) -> 416.
        if start > end or start >= file_size:
            resp = HttpResponse(status=416, content_type=content_type)
            resp["Content-Range"] = f"bytes */{file_size}"
            resp["Accept-Ranges"] = "bytes"
            return resp
        with open(path, "rb") as fh:
            fh.seek(start)
            chunk = fh.read(end - start + 1)
        resp = HttpResponse(chunk, status=206, content_type=content_type)
        resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        resp["Content-Length"] = str(len(chunk))
    else:
        with open(path, "rb") as fh:
            resp = HttpResponse(fh.read(), content_type=content_type)
        resp["Content-Length"] = str(file_size)
    resp["Accept-Ranges"] = "bytes"
    return resp


class FolderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        parent = request.query_params.get("parent") or None
        qs = Folder.objects.filter(owner=request.user, deleted_at__isnull=True, parent=parent).order_by("name")
        return Response(FolderSerializer(qs, many=True).data)

    def post(self, request):
        serializer = FolderCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get("parent")
        name = unique_name(
            serializer.validated_data["name"], _active_folder_names(request.user, parent)
        )
        folder = serializer.save(owner=request.user, name=name)
        return Response(FolderSerializer(folder).data, status=status.HTTP_201_CREATED)


def _active_folder_names(user, parent, exclude_id=None):
    qs = Folder.objects.filter(owner=user, parent=parent, deleted_at__isnull=True)
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    return set(qs.values_list("name", flat=True))


def _active_file_names(user, folder, exclude_id=None):
    qs = File.objects.filter(owner=user, folder=folder, deleted_at__isnull=True)
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    return set(qs.values_list("name", flat=True))


def _is_self_or_descendant(candidate_parent, folder):
    """True if moving `folder` under `candidate_parent` would create a cycle."""
    node = candidate_parent
    while node is not None:
        if node.pk == folder.pk:
            return True
        node = node.parent
    return False


def _subtree_folder_ids(folder):
    """The folder's id plus every descendant folder id (breadth-first)."""
    ids = [folder.pk]
    frontier = [folder.pk]
    while frontier:
        kids = list(Folder.objects.filter(parent_id__in=frontier).values_list("pk", flat=True))
        ids.extend(kids)
        frontier = kids
    return ids


class FolderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, folder_id):
        """Rename and/or move a folder (Drive-style). Auto-suffixes on collision."""
        try:
            folder = Folder.objects.get(pk=folder_id, owner=request.user, deleted_at__isnull=True)
        except Folder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        fields = []
        if "parent" in request.data:
            parent_id = request.data["parent"] or None
            parent = None
            if parent_id:
                parent = Folder.objects.filter(
                    pk=parent_id, owner=request.user, deleted_at__isnull=True
                ).first()
                if parent is None:
                    return Response({"detail": "Invalid destination folder."},
                                    status=status.HTTP_400_BAD_REQUEST)
                if _is_self_or_descendant(parent, folder):
                    return Response({"detail": "Cannot move a folder into itself or a subfolder."},
                                    status=status.HTTP_400_BAD_REQUEST)
            folder.parent = parent
            fields.append("parent")

        if "name" in request.data:
            name = (request.data.get("name") or "").strip()
            if not name:
                return Response({"detail": "Folder name cannot be empty."},
                                status=status.HTTP_400_BAD_REQUEST)
            folder.name = name
            fields.append("name")

        if not fields:
            return Response(FolderSerializer(folder).data)

        # Keep the name unique among active siblings at the (possibly new) parent.
        folder.name = unique_name(
            folder.name, _active_folder_names(request.user, folder.parent, exclude_id=folder.pk)
        )
        if "name" not in fields:
            fields.append("name")
        folder.save(update_fields=[*fields, "updated_at"])
        return Response(FolderSerializer(folder).data)

    def delete(self, request, folder_id):
        try:
            folder = Folder.objects.get(pk=folder_id, owner=request.user, deleted_at__isnull=True)
        except Folder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        now = timezone.now()
        # Cascade: soft-delete the whole subtree, tagging each currently-active
        # descendant with this folder's id so it restores together (and stays
        # hidden from the top-level Trash view).
        descendant_ids = _subtree_folder_ids(folder)[1:]  # excludes the folder itself
        Folder.objects.filter(pk__in=descendant_ids, deleted_at__isnull=True).update(
            deleted_at=now, trashed_root=folder.pk, updated_at=now
        )
        File.objects.filter(
            folder_id__in=[folder.pk, *descendant_ids], deleted_at__isnull=True
        ).update(deleted_at=now, trashed_root=folder.pk, updated_at=now)
        folder.deleted_at = now
        folder.trashed_root = None  # this is the root of the trash action
        folder.save(update_fields=["deleted_at", "trashed_root", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


CAMERA_BACKUP_NAME = "Camera Backup"


class CameraBackupFolderView(APIView):
    """Return (creating if needed) the user's dedicated device-backup folder (PRD 5.10)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        folder, _ = Folder.objects.get_or_create(
            owner=request.user, name=CAMERA_BACKUP_NAME, parent=None, deleted_at__isnull=True,
        )
        return Response(FolderSerializer(folder).data)


class SearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.search.services.base import get_search_service
        results = get_search_service().search(
            query=request.query_params.get("q", ""), user_id=request.user.id,
        )
        return Response({"results": results})


class FileDiscoverableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        try:
            file = File.objects.get(pk=file_id, owner=request.user, deleted_at__isnull=True)
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if "is_discoverable" in request.data:
            file.is_discoverable = bool(request.data["is_discoverable"])
        if "is_mature_content" in request.data:
            file.is_mature_content = bool(request.data["is_mature_content"])
        file.save(update_fields=["is_discoverable", "is_mature_content", "updated_at"])
        return Response({"is_discoverable": file.is_discoverable,
                         "is_mature_content": file.is_mature_content})


class FileDownloadView(APIView):
    """Return a URL to fetch the file's bytes (owner). Presigned in R2, direct in local."""

    permission_classes = [IsAuthenticated]

    def get(self, request, file_id):
        try:
            # Frozen files (lapsed subscription) stay downloadable by design —
            # the freeze blocks viewing/sharing, not the owner getting their
            # bytes out (PRD 5.3). Quarantined files remain blocked.
            file = File.objects.select_related("storage_object").get(
                pk=file_id, owner=request.user, deleted_at__isnull=True,
                is_quarantined=False,
            )
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not file.storage_object_id or file.status != File.Status.READY:
            return Response({"detail": "File is not ready."}, status=status.HTTP_409_CONFLICT)
        obj = file.storage_object
        url = get_storage_service().presign_download(region=obj.region, object_key=obj.object_key)
        return Response({"download_url": url, "name": file.name, "size_bytes": file.size_bytes})


class FileContentView(APIView):
    """Replace a (text) file's content in place — edit-in-place saving."""

    permission_classes = [IsAuthenticated]
    MAX_BYTES = 5 * 1024 * 1024  # inline text editing cap

    @transaction.atomic
    def put(self, request, file_id):
        file = (
            File.objects.select_for_update()
            .select_related("storage_object")
            .filter(pk=file_id, owner=request.user, deleted_at__isnull=True,
                    is_quarantined=False)
            .first()
        )
        if file is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        storage = get_storage_service()
        if not hasattr(storage, "save_bytes"):
            return Response({"detail": "Editing is not supported on this backend."},
                            status=status.HTTP_501_NOT_IMPLEMENTED)

        data = str(request.data.get("content", "")).encode("utf-8")
        if len(data) > self.MAX_BYTES:
            return Response({"detail": "File too large to edit inline.", "code": "file_too_large"},
                            status=status.HTTP_400_BAD_REQUEST)

        old = file.storage_object
        old_size = file.size_bytes or 0
        new_size = len(data)
        delta = new_size - old_size
        if delta > 0 and delta > available_bytes(request.user):
            return Response({"detail": "Not enough storage.", "code": "quota_exceeded"},
                            status=status.HTTP_400_BAD_REQUEST)

        region = request.user.storage_region
        content_hash = hashlib.sha256(data).hexdigest()
        # New content addressed at a sibling key so releasing the old blob can't
        # clobber the new one.
        key = f"{_object_key(request.user.id, file.id)}.{content_hash[:12]}"
        obj, _created = StorageObject.objects.get_or_create(
            content_hash=content_hash, region=region,
            defaults={"size_bytes": new_size, "status": StorageObject.Status.READY, "object_key": key},
        )
        storage.save_bytes(region=region, object_key=obj.object_key, data=data)

        if old and obj.pk == old.pk:
            return Response(FileSerializer(file).data)  # content unchanged

        StorageObject.objects.filter(pk=obj.pk).update(ref_count=F("ref_count") + 1)
        file.storage_object = obj
        file.size_bytes = new_size
        file.save(update_fields=["storage_object", "size_bytes", "updated_at"])
        if old:
            _release_object(old)
        if delta:
            from django.contrib.auth import get_user_model

            get_user_model().objects.filter(pk=request.user.pk).update(
                storage_used_bytes=F("storage_used_bytes") + delta
            )
        return Response(FileSerializer(file).data)


class FileListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        folder = request.query_params.get("folder") or None
        qs = File.objects.filter(
            owner=request.user, deleted_at__isnull=True, is_quarantined=False,
            folder=folder,
        ).select_related("poster_object").order_by("-created_at")
        return Response(FileSerializer(qs, many=True).data)


class UsageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "quota_bytes": u.quota_bytes,
            "used_bytes": u.storage_used_bytes,
            "available_bytes": available_bytes(u),
        })


class FileDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, file_id):
        """Rename and/or move a file between folders. Auto-suffixes on collision."""
        try:
            file = File.objects.get(pk=file_id, owner=request.user, deleted_at__isnull=True)
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        fields = []
        if "folder" in request.data:
            folder_id = request.data["folder"] or None
            folder = None
            if folder_id:
                folder = Folder.objects.filter(
                    pk=folder_id, owner=request.user, deleted_at__isnull=True
                ).first()
                if folder is None:
                    return Response({"detail": "Invalid destination folder."},
                                    status=status.HTTP_400_BAD_REQUEST)
            file.folder = folder
            fields.append("folder")

        if "name" in request.data:
            name = (request.data.get("name") or "").strip()
            if not name:
                return Response({"detail": "File name cannot be empty."},
                                status=status.HTTP_400_BAD_REQUEST)
            file.name = name
            fields.append("name")

        if not fields:
            return Response(FileSerializer(file).data)

        file.name = unique_name(
            file.name, _active_file_names(request.user, file.folder, exclude_id=file.pk)
        )
        if "name" not in fields:
            fields.append("name")
        file.save(update_fields=[*fields, "updated_at"])
        return Response(FileSerializer(file).data)

    def delete(self, request, file_id):
        """Soft-delete (move to trash). Still counts toward quota until purged."""
        try:
            file = File.objects.get(pk=file_id, owner=request.user, deleted_at__isnull=True)
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        file.deleted_at = timezone.now()
        file.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class FileRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        try:
            file = File.objects.get(pk=file_id, owner=request.user, deleted_at__isnull=False)
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        file.deleted_at = None
        # If a live file now occupies the old name here, restore under a variant.
        file.name = unique_name(file.name, _active_file_names(request.user, file.folder, exclude_id=file.pk))
        file.save(update_fields=["deleted_at", "name", "updated_at"])
        return Response(FileSerializer(file).data)


class FilePurgeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        """Permanently delete a trashed file (releases quota, decrements ref_count)."""
        try:
            file = File.objects.get(pk=file_id, owner=request.user, deleted_at__isnull=False)
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        purge_file(file)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FolderPurgeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, folder_id):
        """Permanently delete a trashed folder and everything under it."""
        try:
            folder = Folder.objects.get(pk=folder_id, owner=request.user, deleted_at__isnull=False)
        except Folder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        purge_folder(folder)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FolderRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, folder_id):
        try:
            # Only a top-level trashed folder can be restored on its own; a
            # subfolder trashed as part of an ancestor (trashed_root set) is
            # hidden from Trash and must come back with that ancestor, never
            # independently (which would orphan it under a still-trashed parent).
            folder = Folder.objects.get(
                pk=folder_id, owner=request.user,
                deleted_at__isnull=False, trashed_root__isnull=True,
            )
        except Folder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        # Restore everything trashed together with this folder (but NOT items the
        # user had independently trashed earlier — those have a different/no root).
        now = timezone.now()
        Folder.objects.filter(owner=request.user, trashed_root=folder.pk).update(
            deleted_at=None, trashed_root=None, updated_at=now
        )
        File.objects.filter(owner=request.user, trashed_root=folder.pk).update(
            deleted_at=None, trashed_root=None, updated_at=now
        )
        folder.deleted_at = None
        # If a live folder now occupies the old name here, restore under a variant.
        folder.name = unique_name(
            folder.name, _active_folder_names(request.user, folder.parent, exclude_id=folder.pk)
        )
        folder.save(update_fields=["deleted_at", "name", "updated_at"])
        return Response(FolderSerializer(folder).data)


class TrashView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Only top-level trashed items — children trashed via an ancestor folder
        # (trashed_root set) come back with that folder, not on their own.
        folders = Folder.objects.filter(
            owner=request.user, deleted_at__isnull=False, trashed_root__isnull=True
        ).order_by("-deleted_at")
        files = File.objects.filter(
            owner=request.user, deleted_at__isnull=False, trashed_root__isnull=True
        ).order_by("-deleted_at")
        return Response({
            "folders": FolderSerializer(folders, many=True).data,
            "files": FileSerializer(files, many=True).data,
        })


class UploadInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UploadInitiateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        name = unique_name(data["name"], _active_file_names(request.user, data.get("folder")))
        file = File.objects.create(
            owner=request.user,
            name=name,
            folder=data.get("folder"),
            kind=data["kind"],
            size_bytes=data["size_bytes"],
            status=File.Status.PENDING,
        )
        try:
            reservation = reserve(request.user, size_bytes=data["size_bytes"], file=file)
        except FileTooLarge as exc:
            file.delete()
            return Response({"detail": str(exc), "code": "file_too_large"}, status=status.HTTP_400_BAD_REQUEST)
        except QuotaExceeded as exc:
            file.delete()
            # Device backup pauses on quota — notify the user, don't fail silently (PRD 5.10).
            if request.data.get("is_backup"):
                from apps.notifications.dispatch import notify
                notify(request.user, type="quota", title="Backup paused — storage full",
                       body="Free up space or upgrade to resume Camera Backup.")
            return Response({"detail": str(exc), "code": "quota_exceeded"}, status=status.HTTP_400_BAD_REQUEST)

        object_key = _object_key(request.user.id, file.id)
        presigned = get_storage_service().presign_upload(
            region=request.user.storage_region, object_key=object_key, max_bytes=data["size_bytes"]
        )
        return Response(
            {
                "file": FileSerializer(file).data,
                "reservation_id": str(reservation.id),
                "upload": {"url": presigned.url, "fields": presigned.fields, "object_key": object_key},
            },
            status=status.HTTP_201_CREATED,
        )


class UploadCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        try:
            file = File.objects.get(pk=file_id, owner=request.user, status=File.Status.PENDING)
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        region = request.user.storage_region
        object_key = _object_key(request.user.id, file.id)
        storage = get_storage_service()

        # Determine the real size + content hash of the uploaded blob.
        # (Dev/Local exposes stat(); production R2 completion is wired in a later slice.)
        if not hasattr(storage, "stat"):
            return Response(
                {"detail": "Upload completion for this storage backend is not wired yet."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        try:
            size_bytes, content_hash = storage.stat(region=region, object_key=object_key)
        except FileNotFoundError:
            return Response({"detail": "No uploaded bytes found for this file."},
                            status=status.HTTP_409_CONFLICT)

        # Malware scan before the file is allowed to go `ready` (PRD 5.7). On a
        # hit the file is quarantined, the blob deleted, and its reservation
        # released (never committed) so a rejected upload costs no quota.
        if hasattr(storage, "read_bytes"):
            from apps.moderation.services.base import get_scan_service
            try:
                result = get_scan_service().scan(storage.read_bytes(region=region, object_key=object_key))
            except Exception:  # noqa: BLE001 — scanner unreachable/errored
                # Apply the configured downtime policy (PRD 5.7 open question).
                mode = getattr(settings, "SCAN_FAILURE_MODE", "closed")
                if mode == "open":
                    result = None  # proceed unscanned (opt-in, risky)
                else:
                    # Fail closed: block + quarantine, release the reservation.
                    file.status = File.Status.FAILED
                    file.is_quarantined = True
                    file.save(update_fields=["status", "is_quarantined", "updated_at"])
                    storage.delete_object(region=region, object_key=object_key)
                    res = file.reservations.filter(status=StorageReservation.Status.ACTIVE).first()
                    if res:
                        res.status = StorageReservation.Status.EXPIRED
                        res.save(update_fields=["status", "updated_at"])
                    return Response(
                        {"detail": "Upload could not be scanned right now. Please try again shortly.",
                         "code": "scan_unavailable", "status": "failed"},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE,
                    )
            if result is not None and not result.clean:
                file.status = File.Status.FAILED
                file.is_quarantined = True
                file.save(update_fields=["status", "is_quarantined", "updated_at"])
                storage.delete_object(region=region, object_key=object_key)
                res = file.reservations.filter(status=StorageReservation.Status.ACTIVE).first()
                if res:
                    res.status = StorageReservation.Status.EXPIRED
                    res.save(update_fields=["status", "updated_at"])
                return Response(
                    {"detail": "Upload blocked: failed the malware scan.",
                     "code": "scan_failed", "status": "failed"},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

        # Per-region dedup: reuse an existing blob or create a new one.
        obj, _created = StorageObject.objects.get_or_create(
            content_hash=content_hash,
            region=region,
            defaults={"size_bytes": size_bytes, "status": StorageObject.Status.READY, "object_key": object_key},
        )
        StorageObject.objects.filter(pk=obj.pk).update(ref_count=F("ref_count") + 1)

        file.storage_object = obj
        file.size_bytes = size_bytes
        # Videos go `processing` while a self-hosted FFmpeg transcode produces a
        # browser-playable MP4 rendition + poster; everything else is ready now.
        is_video = file.kind == File.Kind.VIDEO
        file.status = File.Status.PROCESSING if is_video else File.Status.READY
        file.save(update_fields=["storage_object", "size_bytes", "status", "updated_at"])

        res = file.reservations.filter(status=StorageReservation.Status.ACTIVE).first()
        if res:
            commit(res, actual_bytes=size_bytes)  # charge the real size, not the claimed one
        else:
            # The reservation lapsed before completion (slow/large upload past the
            # 1h TTL). The bytes are real and on disk, so account for them anyway,
            # or a later purge would drive storage_used_bytes negative.
            from .quota import charge_usage
            charge_usage(request.user, size_bytes)

        if is_video:
            from .tasks import transcode_video_task
            transcode_video_task.delay(str(file.id))
            file.refresh_from_db()  # eager task (dev/tests) may already have finished

        from apps.analytics.track import track
        track("upload_complete", user=request.user, kind=file.kind, size_bytes=file.size_bytes)
        return Response(FileSerializer(file).data, status=status.HTTP_200_OK)


class DevBlobView(APIView):
    """DEV-ONLY blob store (stands in for R2 presigned PUT/GET). No auth on GET download token in dev."""

    permission_classes = [IsAuthenticated]

    def put(self, request, region, object_key):
        storage = get_storage_service()
        if not hasattr(storage, "save_bytes"):
            return Response(status=status.HTTP_404_NOT_FOUND)
        storage.save_bytes(region=region, object_key=object_key, data=request.body)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get(self, request, region, object_key):
        """Serve a locally-stored blob with HTTP Range support (video seeking)."""
        storage = get_storage_service()
        if not hasattr(storage, "local_path"):
            return Response(status=status.HTTP_404_NOT_FOUND)
        path = storage.local_path(region=region, object_key=object_key)
        if not path.exists():
            return Response(status=status.HTTP_404_NOT_FOUND)
        return _ranged_file_response(request, path, self._content_type(object_key))

    @staticmethod
    def _content_type(object_key):
        import mimetypes
        # Rendition keys carry their own extension (….play.mp4, ….poster.jpg).
        ctype, _ = mimetypes.guess_type(object_key)
        if ctype:
            return ctype
        # Original uploads are keyed by "<user_id>/<file_id>" (no extension);
        # guess from the File's name instead.
        try:
            file_id = object_key.split("/")[-1]
            f = File.objects.filter(pk=file_id).only("name").first()
            if f:
                ctype, _ = mimetypes.guess_type(f.name)
                if ctype:
                    return ctype
        except Exception:  # noqa: BLE001
            pass
        return "application/octet-stream"

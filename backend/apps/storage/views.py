"""
Storage API: folders, files, and the reserve-then-commit upload flow.

Upload flow (presigned direct-to-storage):
  1. POST uploads/          -> reserve quota, create pending File, return presign
  2. PUT  <presigned url>   -> client uploads bytes (dev: LocalStorageService blob)
  3. POST uploads/<id>/complete -> dedup StorageObject, commit reservation, File ready
"""
from django.db.models import F
from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

import uuid

from django.db import transaction

from .lifecycle import _release_object, purge_file, purge_folder
from .models import File, Folder, StorageObject, StorageReservation
from .naming import classify_kind, sanitize_name, unique_name
from .quota import (
    FileTooLarge,
    QuotaExceeded,
    available_bytes,
    commit,
    disk_free_bytes,
    instance_used_bytes,
    overflow_allowed,
    reserve,
    storage_total_bytes,
)
from .scoping import folder_in_scope, is_scoped, scope_files, scope_folders, scoped_folder_ids
from .serializers import (
    FileSerializer,
    FolderCreateSerializer,
    FolderSerializer,
    UploadInitiateSerializer,
)
from .config import effective_backend
from .services.base import get_storage_service


def _object_key(user_id, file_id) -> str:
    return f"{user_id}/{file_id}"


def _folder_filter_param(request, key="folder"):
    """Parse a folder/parent query param. Returns (value, ok):
      (None, True)      -> absent (list the storage root)
      (uuid_str, True)  -> a syntactically valid id
      (None, False)     -> present but malformed - caller should return [] rather
                           than let the DB raise (a bad ?folder= must not 500).
    """
    import uuid as _uuid

    raw = request.query_params.get(key) or None
    if raw is None:
        return None, True
    try:
        return str(_uuid.UUID(raw)), True
    except (ValueError, TypeError):
        return None, False


_STREAM_BLOCK = 64 * 1024


def _iter_file_range(path, start, length, block=_STREAM_BLOCK):
    """Yield `length` bytes from `path` starting at `start`, in bounded blocks."""
    with open(path, "rb") as fh:
        fh.seek(start)
        remaining = length
        while remaining > 0:
            data = fh.read(min(block, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def _kick_off_transcode(file_id: str) -> None:
    """Start the video transcode without blocking the request.

    In the single-container standalone deployment a Celery `.delay()` runs the
    FFmpeg transcode INLINE (eager), which for a real video easily exceeds
    gunicorn's request timeout and kills the worker (the upload then appears to
    fail). Run it in a daemon thread instead: the file stays PROCESSING and the
    client polls for READY. In tests (eager but not standalone) and with a real
    Celery worker, dispatch the task as usual so behavior stays synchronous /
    worker-driven respectively.
    """
    from django.conf import settings

    from .tasks import transcode_video_task

    if getattr(settings, "STANDALONE", False):
        import logging
        import threading

        from django.db import connection

        def _run():
            try:
                from .video_processing import process_video

                process_video(file_id)
            except Exception:  # noqa: BLE001 - never crash the background thread
                logging.getLogger("storage").exception("video transcode failed: %s", file_id)
            finally:
                connection.close()  # don't leak this thread's DB connection

        threading.Thread(target=_run, name=f"transcode-{file_id}", daemon=True).start()
    else:
        transcode_video_task.delay(file_id)


def _content_disposition(name: str) -> str:
    """An attachment Content-Disposition that carries the display name.

    Uses RFC 5987 `filename*` (UTF-8) for correctness with non-ASCII names, plus
    an ASCII `filename=` fallback for old clients. Strips path separators/quotes
    so the header can't be broken or spoofed.
    """
    from urllib.parse import quote

    safe = (name or "download").replace("\\", "_").replace("/", "_").replace('"', "")
    ascii_fallback = safe.encode("ascii", "ignore").decode("ascii") or "download"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(safe)}"


def _ranged_file_response(request, path, content_type, download_name=None):
    """Serve a file from disk honoring the HTTP Range header (206 partial).

    Streams in bounded blocks (never reads the whole file, or a whole requested
    range, into memory) so a large download can't OOM the worker. When
    `download_name` is given, forces a download named that (else served inline).
    """
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
        length = end - start + 1
        resp = StreamingHttpResponse(
            _iter_file_range(path, start, length), status=206, content_type=content_type
        )
        resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        resp["Content-Length"] = str(length)
    else:
        # Stream via a plain generator rather than FileResponse's wsgi.file_wrapper
        # (sendfile). Some HTTP/2 edge proxies (e.g. Railway) mis-frame the
        # sendfile path and the browser aborts with ERR_HTTP2_PROTOCOL_ERROR;
        # a normal chunked generator with an explicit Content-Length is safe.
        resp = StreamingHttpResponse(
            _iter_file_range(path, 0, file_size), content_type=content_type
        )
        resp["Content-Length"] = str(file_size)
    resp["Accept-Ranges"] = "bytes"
    if download_name:
        resp["Content-Disposition"] = _content_disposition(download_name)
    return resp


class FolderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        parent, ok = _folder_filter_param(request, "parent")
        if not ok:
            return Response([])  # malformed ?parent= -> empty, never a 500
        # A scoped key browses downward from its own root id; it can't use an
        # out-of-scope folder (or the storage root) as a browse anchor.
        if not folder_in_scope(request, parent):
            return Response([])
        qs = scope_folders(
            Folder.objects.filter(owner=request.user, deleted_at__isnull=True, parent=parent),
            request,
        ).order_by("name")
        return Response(FolderSerializer(qs, many=True).data)

    def post(self, request):
        serializer = FolderCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get("parent")
        # A folder-scoped key may only create inside its subtree (a parentless
        # folder would land at the storage root, outside the key's reach).
        if not folder_in_scope(request, parent.pk if parent else None):
            return Response({"detail": "This key can only create folders inside its allowed folder."},
                            status=status.HTTP_400_BAD_REQUEST)
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
            folder = scope_folders(
                Folder.objects.filter(pk=folder_id, owner=request.user, deleted_at__isnull=True),
                request,
            ).get()
        except Folder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        fields = []
        if "parent" in request.data:
            parent_id = request.data["parent"] or None
            # Destination must be within the key's scope (a parentless move would
            # relocate the folder to the storage root, outside a scoped key).
            if not folder_in_scope(request, parent_id):
                return Response({"detail": "Destination is outside this key's allowed folder."},
                                status=status.HTTP_400_BAD_REQUEST)
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
            name = sanitize_name(request.data.get("name") or "")
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
            folder = scope_folders(
                Folder.objects.filter(pk=folder_id, owner=request.user, deleted_at__isnull=True),
                request,
            ).get()
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
    """Return (creating if needed) the user's dedicated device-backup folder."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Camera Backup is a top-level (parentless) folder, so a folder-scoped
        # key can never legitimately reach it - refuse rather than silently
        # create a folder outside the key's scope.
        if is_scoped(request):
            return Response({"detail": "This key is limited to a folder and cannot use device backup."},
                            status=status.HTTP_403_FORBIDDEN)
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
            folder_ids=scoped_folder_ids(request),
        )
        return Response({"results": results})


class FileDiscoverableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        try:
            file = scope_files(
                File.objects.filter(pk=file_id, owner=request.user, deleted_at__isnull=True),
                request,
            ).get()
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
            file = scope_files(
                File.objects.select_related("storage_object").filter(
                    pk=file_id, owner=request.user, deleted_at__isnull=True,
                ),
                request,
            ).get()
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not file.storage_object_id or file.status != File.Status.READY:
            return Response({"detail": "File is not ready."}, status=status.HTTP_409_CONFLICT)
        obj = file.storage_object
        # `?download=1` -> force a download named the display name (the button);
        # without it the URL serves inline (image/PDF/video previews).
        as_attachment = bool(request.query_params.get("download"))
        url = get_storage_service().presign_download(
            region=obj.region, object_key=obj.object_key,
            filename=file.name, as_attachment=as_attachment,
        )
        return Response({"download_url": url, "name": file.name, "size_bytes": file.size_bytes})


class FileContentView(APIView):
    """Replace a (text) file's content in place - edit-in-place saving."""

    permission_classes = [IsAuthenticated]
    MAX_BYTES = 5 * 1024 * 1024  # inline text editing cap

    @transaction.atomic
    def put(self, request, file_id):
        file = scope_files(
            File.objects.select_for_update()
            .select_related("storage_object")
            .filter(pk=file_id, owner=request.user, deleted_at__isnull=True),
            request,
        ).first()
        if file is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        # Only a fully-committed file can be edited. Editing a PENDING file (whose
        # size_bytes is the *claimed*, uncommitted size) would make the quota delta
        # wildly negative and drive storage_used_bytes below zero.
        if file.status != File.Status.READY:
            return Response({"detail": "File is not ready."}, status=status.HTTP_409_CONFLICT)
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
        content_hash = storage.content_hash(data)
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
        # Content changed - refresh the full-text index and warm the graph.
        if file.kind == File.Kind.DOC:
            from .indexing import reindex_file
            reindex_file(file)
        from apps.graph.tasks import schedule_rebuild
        schedule_rebuild(request.user)
        return Response(FileSerializer(file).data)


class FileListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        folder, ok = _folder_filter_param(request, "folder")
        if not ok:
            return Response([])  # malformed ?folder= -> empty, never a 500
        # A scoped key browses downward from its own root id; an out-of-scope
        # anchor (or the storage root) yields nothing.
        if not folder_in_scope(request, folder):
            return Response([])
        # Exclude PENDING files: an upload that was initiated but never completed
        # has no bytes yet and must not appear as a 0-byte file in the listing.
        qs = scope_files(
            File.objects.filter(owner=request.user, deleted_at__isnull=True, folder=folder),
            request,
        ).exclude(status=File.Status.PENDING).select_related("poster_object").order_by("-created_at")
        return Response(FileSerializer(qs, many=True).data)


class UsageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Single-tenant: usage + ceiling are instance-wide (one shared pool),
        # not per user. "used" is the deduplicated real footprint.
        total = storage_total_bytes()
        used = instance_used_bytes()
        return Response({
            "quota_bytes": total,
            "used_bytes": used,
            "available_bytes": available_bytes(),
            # Real free space on the server volume (null on R2), so the UI can
            # warn before the disk is physically full.
            "disk_free_bytes": disk_free_bytes(),
            "backend": effective_backend(),
            # R2 budget can be a soft cap (overflow on) that usage may exceed.
            "overflow_allowed": overflow_allowed(),
            "over_cap": used > total,
        })


class FileDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, file_id):
        """Rename and/or move a file between folders. Auto-suffixes on collision."""
        try:
            file = scope_files(
                File.objects.filter(pk=file_id, owner=request.user, deleted_at__isnull=True),
                request,
            ).get()
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        fields = []
        if "folder" in request.data:
            folder_id = request.data["folder"] or None
            # Destination must be within the key's scope (moving to the storage
            # root - folder=None - is outside a scoped key).
            if not folder_in_scope(request, folder_id):
                return Response({"detail": "Destination is outside this key's allowed folder."},
                                status=status.HTTP_400_BAD_REQUEST)
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
            name = sanitize_name(request.data.get("name") or "")
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
            file = scope_files(
                File.objects.filter(pk=file_id, owner=request.user, deleted_at__isnull=True),
                request,
            ).get()
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        file.deleted_at = timezone.now()
        file.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class FileRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        try:
            file = scope_files(
                File.objects.filter(pk=file_id, owner=request.user, deleted_at__isnull=False),
                request,
            ).get()
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
            file = scope_files(
                File.objects.filter(pk=file_id, owner=request.user, deleted_at__isnull=False),
                request,
            ).get()
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        purge_file(file)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FolderPurgeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, folder_id):
        """Permanently delete a trashed folder and everything under it."""
        try:
            folder = scope_folders(
                Folder.objects.filter(pk=folder_id, owner=request.user, deleted_at__isnull=False),
                request,
            ).get()
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
            folder = scope_folders(
                Folder.objects.filter(
                    pk=folder_id, owner=request.user,
                    deleted_at__isnull=False, trashed_root__isnull=True,
                ),
                request,
            ).get()
        except Folder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        # Restore everything trashed together with this folder (but NOT items the
        # user had independently trashed earlier - those have a different/no root).
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
        # Only top-level trashed items - children trashed via an ancestor folder
        # (trashed_root set) come back with that folder, not on their own.
        folders = scope_folders(
            Folder.objects.filter(
                owner=request.user, deleted_at__isnull=False, trashed_root__isnull=True
            ),
            request,
        ).order_by("-deleted_at")
        files = scope_files(
            File.objects.filter(
                owner=request.user, deleted_at__isnull=False, trashed_root__isnull=True
            ),
            request,
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

        # A folder-scoped key can only upload inside its subtree (an upload with
        # no folder would land at the storage root, outside the key's reach).
        target = data.get("folder")
        if not folder_in_scope(request, target.pk if target else None):
            return Response({"detail": "This key can only upload inside its allowed folder."},
                            status=status.HTTP_400_BAD_REQUEST)

        safe = sanitize_name(data["name"])
        if not safe:
            return Response({"detail": "File name cannot be empty."},
                            status=status.HTTP_400_BAD_REQUEST)
        name = unique_name(safe, _active_file_names(request.user, data.get("folder")))
        # Derive kind from the name/content-type when the client left it at the
        # generic default (REST/MCP clients often omit it). This keeps the
        # knowledge graph able to scan documents regardless of upload path; a
        # client that sends an explicit kind is always respected.
        kind = data["kind"]
        if kind == File.Kind.FILE:
            kind = classify_kind(name, data.get("content_type"))
        file = File.objects.create(
            owner=request.user,
            name=name,
            folder=data.get("folder"),
            kind=kind,
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
            # Device backup pauses on quota - notify the user, don't fail silently.
            if request.data.get("is_backup"):
                from apps.notifications.dispatch import notify
                notify(request.user, type="quota", title="Backup paused - storage full",
                       body="Free up space to resume Camera Backup.")
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
            file = scope_files(
                File.objects.filter(pk=file_id, owner=request.user, status=File.Status.PENDING),
                request,
            ).get()
        except File.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        region = request.user.storage_region
        object_key = _object_key(request.user.id, file.id)
        storage = get_storage_service()

        # Determine the real size + content hash of the uploaded blob. Both the
        # Local and R2 backends implement stat(); a backend without it can't
        # verify a completed upload, so we refuse rather than trust the client.
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
            _kick_off_transcode(str(file.id))
            file.refresh_from_db()  # background/eager run may already have finished

        # Extract document text for full-text (content) search (best-effort).
        if file.kind == File.Kind.DOC:
            from .indexing import reindex_file
            reindex_file(file)

        # Warm the knowledge graph off the request path (no-op in eager mode).
        from apps.graph.tasks import schedule_rebuild
        schedule_rebuild(request.user)

        from apps.analytics.track import track
        track("upload_complete", user=request.user, kind=file.kind, size_bytes=file.size_bytes)
        return Response(FileSerializer(file).data, status=status.HTTP_200_OK)


class NoteCreateView(APIView):
    """Create a note - a Markdown document - in a single call.

    Notes are ordinary doc-kind files, but a note editor shouldn't have to run
    the 3-step upload dance just to make a blank page. This collapses
    initiate+put+complete: it creates the file, stores the (optional) initial
    text, commits quota, and indexes it for search + the knowledge graph - so
    the editor can create-then-edit smoothly. Content is then edited in place via
    PUT /files/{id}/content like any other document.
    """

    permission_classes = [IsAuthenticated]
    MAX_BYTES = 5 * 1024 * 1024

    @transaction.atomic
    def post(self, request):
        folder = None
        folder_id = request.data.get("folder")
        if folder_id:
            # Validate the id shape first so a malformed value is a clean 400,
            # not a 500 when the DB tries to cast it to a UUID.
            try:
                folder_uuid = uuid.UUID(str(folder_id))
            except (ValueError, TypeError, AttributeError):
                return Response({"detail": "Invalid folder."}, status=status.HTTP_400_BAD_REQUEST)
            folder = scope_folders(
                Folder.objects.filter(owner=request.user, deleted_at__isnull=True), request
            ).filter(pk=folder_uuid).first()
            if folder is None:
                return Response({"detail": "Invalid folder."}, status=status.HTTP_400_BAD_REQUEST)
        # A folder-scoped key may only create inside its subtree.
        if not folder_in_scope(request, folder.pk if folder else None):
            return Response({"detail": "This key can only create inside its allowed folder."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Notes are written server-side, so the backend must accept bytes here.
        # Refuse up front (rather than create a phantom note that charges quota
        # but stored nothing) on a backend that can't - mirrors FileContentView.
        storage = get_storage_service()
        if not hasattr(storage, "save_bytes"):
            return Response({"detail": "Creating notes is not supported on this backend."},
                            status=status.HTTP_501_NOT_IMPLEMENTED)

        raw = sanitize_name(str(request.data.get("name") or "")) or "Untitled note"
        if not raw.lower().endswith(".md"):
            raw += ".md"
        name = unique_name(raw, _active_file_names(request.user, folder))

        data = str(request.data.get("content", "")).encode("utf-8")
        if len(data) > self.MAX_BYTES:
            return Response({"detail": "Note too large.", "code": "file_too_large"},
                            status=status.HTTP_400_BAD_REQUEST)
        size = len(data)
        if size > available_bytes(request.user):
            return Response({"detail": "Not enough storage.", "code": "quota_exceeded"},
                            status=status.HTTP_400_BAD_REQUEST)

        file = File.objects.create(
            owner=request.user, name=name, folder=folder,
            kind=File.Kind.DOC, size_bytes=size, status=File.Status.READY,
        )
        region = request.user.storage_region
        content_hash = storage.content_hash(data)
        object_key = _object_key(request.user.id, file.id)
        obj, _created = StorageObject.objects.get_or_create(
            content_hash=content_hash, region=region,
            defaults={"size_bytes": size, "status": StorageObject.Status.READY, "object_key": object_key},
        )
        StorageObject.objects.filter(pk=obj.pk).update(ref_count=F("ref_count") + 1)
        storage.save_bytes(region=region, object_key=obj.object_key, data=data)
        file.storage_object = obj
        file.save(update_fields=["storage_object"])
        if size:
            from .quota import charge_usage
            charge_usage(request.user, size)

        from .indexing import reindex_file
        reindex_file(file)
        from apps.graph.tasks import schedule_rebuild
        schedule_rebuild(request.user)
        return Response(FileSerializer(file).data, status=status.HTTP_201_CREATED)


class DevBlobView(APIView):
    """Local-disk blob store standing in for R2 presigned PUT/GET.

    This is the storage delivery path when the local backend is in use. Access
    is restricted to the owner: every object_key is namespaced by the owning
    user's id ("<user_id>/..." for blobs, "exports/<user_id>/..." for exports),
    so a caller may only read/write keys under their own namespace.
    """

    permission_classes = [IsAuthenticated]

    @staticmethod
    def _owns_key(user, object_key: str) -> bool:
        parts = object_key.split("/")
        uid = str(user.id)
        if parts and parts[0] == uid:
            return True
        return len(parts) >= 2 and parts[0] == "exports" and parts[1] == uid

    def _can_read(self, user, object_key: str) -> bool:
        """Authorize a blob read. Own-namespace keys pass directly; a key under
        another user's namespace is allowed only when this user owns a File that
        references it - which is exactly the content-addressed dedup case (a
        second uploader's File reuses the first uploader's StorageObject, whose
        object_key stays under the first uploader). Without this, an owner can't
        download their own deduplicated file."""
        return self._owns_key(user, object_key) or self._file_for_key(user, object_key) is not None

    @staticmethod
    def _file_for_key(user, object_key):
        """Best-effort: the File a blob key belongs to (original, edited, or a
        video rendition/poster). Used to enforce folder scope on the local
        delivery path."""
        import uuid as _uuid
        from django.db.models import Q

        f = File.objects.filter(
            Q(storage_object__object_key=object_key)
            | Q(playable_object__object_key=object_key)
            | Q(poster_object__object_key=object_key),
            owner=user,
        ).first()
        if f:
            return f
        parts = object_key.split("/")
        if len(parts) >= 2 and parts[0] == str(user.id):
            candidate = parts[1].split(".")[0]  # "<file_id>[.hash|.play|.poster]"
            try:
                _uuid.UUID(candidate)
            except ValueError:
                return None
            return File.objects.filter(pk=candidate, owner=user).first()
        return None

    def _blocked_by_scope(self, request, object_key) -> bool:
        """A folder-scoped key may only touch blobs for files in its subtree
        (and never account-level exports)."""
        if not is_scoped(request):
            return False
        if object_key.split("/")[:1] == ["exports"]:
            return True
        f = self._file_for_key(request.user, object_key)
        return f is None or not folder_in_scope(request, f.folder_id)

    # No DRF body parsing: we stream the raw request straight to disk, so parsers
    # (which would buffer the whole upload and enforce DATA_UPLOAD_MAX_MEMORY_SIZE)
    # must not touch it.
    parser_classes = []

    def put(self, request, region, object_key):
        if not self._owns_key(request.user, object_key) or self._blocked_by_scope(request, object_key):
            return Response(status=status.HTTP_404_NOT_FOUND)
        storage = get_storage_service()
        try:
            if hasattr(storage, "save_stream"):
                # Stream chunks to disk - never buffer the whole (possibly multi-GB
                # video) upload in memory, and bypass Django's 2.5 MB request.body
                # cap that was aborting large uploads (ERR_HTTP2_PROTOCOL_ERROR).
                src = request._request  # underlying Django HttpRequest (raw stream)
                storage.save_stream(
                    region=region, object_key=object_key,
                    chunks=iter(lambda: src.read(1024 * 1024), b""),
                )
            elif hasattr(storage, "save_bytes"):
                storage.save_bytes(region=region, object_key=object_key, data=request.body)
            else:
                return Response(status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get(self, request, region, object_key):
        """Serve a locally-stored blob with HTTP Range support (video seeking)."""
        if not self._can_read(request.user, object_key) or self._blocked_by_scope(request, object_key):
            return Response(status=status.HTTP_404_NOT_FOUND)
        storage = get_storage_service()
        if not hasattr(storage, "local_path"):
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            path = storage.local_path(region=region, object_key=object_key)
        except ValueError:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not path.exists():
            return Response(status=status.HTTP_404_NOT_FOUND)
        # ?dl=<name> forces an attachment download with the display name (set by
        # the download button); without it the blob is served inline for previews.
        dl = request.query_params.get("dl") or None
        resp = _ranged_file_response(request, path, self._content_type(object_key), download_name=dl)
        # Same-origin previews embed this blob in an <iframe> (PDF reader) and
        # <img>/<video> tags; the site-wide X-Frame-Options: DENY would blank the
        # PDF viewer. Allow same-origin framing for this owner-scoped blob only.
        resp["X-Frame-Options"] = "SAMEORIGIN"
        return resp

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

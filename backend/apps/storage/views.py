"""
Storage API: folders, files, and the reserve-then-commit upload flow.

Upload flow (presigned direct-to-storage):
  1. POST uploads/          -> reserve quota, create pending File, return presign
  2. PUT  <presigned url>   -> client uploads bytes (dev: LocalStorageService blob)
  3. POST uploads/<id>/complete -> dedup StorageObject, commit reservation, File ready
"""
from django.db.models import F
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .lifecycle import purge_file
from .models import File, Folder, StorageObject, StorageReservation
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


class FolderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        parent = request.query_params.get("parent") or None
        qs = Folder.objects.filter(owner=request.user, deleted_at__isnull=True, parent=parent).order_by("name")
        return Response(FolderSerializer(qs, many=True).data)

    def post(self, request):
        serializer = FolderCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        folder = serializer.save(owner=request.user)
        return Response(FolderSerializer(folder).data, status=status.HTTP_201_CREATED)


class FolderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, folder_id):
        try:
            folder = Folder.objects.get(pk=folder_id, owner=request.user, deleted_at__isnull=True)
        except Folder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        folder.deleted_at = timezone.now()
        folder.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class FileListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        folder = request.query_params.get("folder") or None
        qs = File.objects.filter(
            owner=request.user, deleted_at__isnull=True, folder=folder
        ).order_by("-created_at")
        return Response(FileSerializer(qs, many=True).data)


class UsageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "quota_bytes": u.quota_bytes,
            "used_bytes": u.storage_used_bytes,
            "available_bytes": available_bytes(u),
            "tier": u.tier,
        })


class FileDetailView(APIView):
    permission_classes = [IsAuthenticated]

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
        file.save(update_fields=["deleted_at", "updated_at"])
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


class FolderRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, folder_id):
        try:
            folder = Folder.objects.get(pk=folder_id, owner=request.user, deleted_at__isnull=False)
        except Folder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        folder.deleted_at = None
        folder.save(update_fields=["deleted_at", "updated_at"])
        return Response(FolderSerializer(folder).data)


class TrashView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        folders = Folder.objects.filter(owner=request.user, deleted_at__isnull=False).order_by("-deleted_at")
        files = File.objects.filter(owner=request.user, deleted_at__isnull=False).order_by("-deleted_at")
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

        file = File.objects.create(
            owner=request.user,
            name=data["name"],
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

        # Per-region dedup: reuse an existing blob or create a new one.
        obj, _created = StorageObject.objects.get_or_create(
            content_hash=content_hash,
            region=region,
            defaults={"size_bytes": size_bytes, "status": StorageObject.Status.READY, "object_key": object_key},
        )
        StorageObject.objects.filter(pk=obj.pk).update(ref_count=F("ref_count") + 1)

        file.storage_object = obj
        file.size_bytes = size_bytes
        file.status = File.Status.READY  # scan hook (ClamAV) runs before this in a later slice
        file.save(update_fields=["storage_object", "size_bytes", "status", "updated_at"])

        res = file.reservations.filter(status=StorageReservation.Status.ACTIVE).first()
        if res:
            commit(res)

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
        storage = get_storage_service()
        if not hasattr(storage, "read_bytes"):
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            data = storage.read_bytes(region=region, object_key=object_key)
        except FileNotFoundError:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return HttpResponse(data, content_type="application/octet-stream")

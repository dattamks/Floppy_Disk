from django.contrib import admin

from .models import File, Folder, StorageObject, StorageReservation


@admin.register(StorageObject)
class StorageObjectAdmin(admin.ModelAdmin):
    list_display = ("content_hash", "region", "size_bytes", "ref_count", "status")
    list_filter = ("region", "status")
    search_fields = ("content_hash",)


@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "parent", "deleted_at", "created_at")
    search_fields = ("name", "owner__email")
    raw_id_fields = ("owner", "parent")


@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "kind", "status", "size_bytes", "deleted_at")
    list_filter = ("kind", "status")
    search_fields = ("name", "owner__email")
    raw_id_fields = ("owner", "folder", "storage_object")


@admin.register(StorageReservation)
class StorageReservationAdmin(admin.ModelAdmin):
    list_display = ("owner", "bytes", "status", "expires_at", "created_at")
    list_filter = ("status",)
    raw_id_fields = ("owner", "file")

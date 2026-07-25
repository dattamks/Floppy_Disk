from django.contrib import admin

from .models import User, UserDevice


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "status", "email_verified", "storage_region", "is_staff", "created_at")
    list_filter = ("status", "email_verified", "is_staff", "storage_region")
    search_fields = ("email", "display_name", "phone")
    ordering = ("-created_at",)
    readonly_fields = ("id", "created_at", "updated_at", "last_login", "last_login_at")


@admin.register(UserDevice)
class UserDeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "device_type", "device_id", "last_seen")
    list_filter = ("device_type",)
    search_fields = ("user__email", "device_id")

from .models import ConsentLog, DataExport  # noqa: E402


@admin.register(ConsentLog)
class ConsentLogAdmin(admin.ModelAdmin):
    list_display = ("user", "policy", "version", "created_at")
    search_fields = ("user__email", "version")


@admin.register(DataExport)
class DataExportAdmin(admin.ModelAdmin):
    list_display = ("user", "size_bytes", "expires_at", "created_at")
    search_fields = ("user__email",)

from django.contrib import admin

from .models import ContentReport


@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = ("kind", "target_type", "target_id", "reason", "status", "reporter", "created_at")
    list_filter = ("kind", "target_type", "reason", "status")
    search_fields = ("target_id", "reporter__email", "detail")
    readonly_fields = ("id", "created_at", "updated_at")

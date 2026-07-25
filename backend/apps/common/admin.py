from django.contrib import admin

from .models import Grievance


@admin.register(Grievance)
class GrievanceAdmin(admin.ModelAdmin):
    list_display = ("subject", "email", "reporter", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("subject", "body", "email")
    readonly_fields = ("created_at", "updated_at")

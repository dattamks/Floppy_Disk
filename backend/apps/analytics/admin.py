from django.contrib import admin

from .models import AnalyticsEvent


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "month", "created_at")
    list_filter = ("name", "month")
    search_fields = ("name", "user__email")
    readonly_fields = ("id", "created_at", "updated_at")

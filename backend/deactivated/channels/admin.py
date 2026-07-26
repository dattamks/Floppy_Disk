from django.contrib import admin

from .models import Channel, ChannelMembership, ChannelPost


@admin.register(Channel)
class ChannelAdmin(admin.ModelAdmin):
    list_display = ("name", "handle", "owner", "is_public", "created_at")
    list_filter = ("is_public",)
    search_fields = ("name", "handle", "owner__email")
    raw_id_fields = ("owner",)


@admin.register(ChannelMembership)
class ChannelMembershipAdmin(admin.ModelAdmin):
    list_display = ("channel", "user", "role")
    list_filter = ("role",)
    raw_id_fields = ("channel", "user")


@admin.register(ChannelPost)
class ChannelPostAdmin(admin.ModelAdmin):
    list_display = ("channel", "author", "created_at")
    raw_id_fields = ("channel", "author", "file")

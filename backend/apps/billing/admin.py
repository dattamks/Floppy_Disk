from django.contrib import admin

from .models import ReferralBonus, Subscription, WebhookEvent


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "plan_code", "status", "current_period_end", "created_at")
    list_filter = ("plan_code", "status")
    search_fields = ("user__email", "gateway_subscription_id")
    raw_id_fields = ("user",)


@admin.register(ReferralBonus)
class ReferralBonusAdmin(admin.ModelAdmin):
    list_display = ("user", "referee", "bytes", "expires_at")
    raw_id_fields = ("user", "referee")


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ("gateway", "event_id", "event_type", "created_at")
    search_fields = ("event_id",)

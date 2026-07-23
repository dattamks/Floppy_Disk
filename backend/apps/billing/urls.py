"""Billing routes (mounted at /api/v1/billing/)."""
from django.urls import path

from . import views

app_name = "billing"

urlpatterns = [
    path("plans", views.PlanListView.as_view(), name="plans"),
    path("subscribe", views.SubscribeView.as_view(), name="subscribe"),
    path("subscription", views.SubscriptionView.as_view(), name="subscription"),
    path("cancel", views.CancelView.as_view(), name="cancel"),
    path("webhook", views.WebhookView.as_view(), name="webhook"),
]

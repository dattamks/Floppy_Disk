"""Channel routes (mounted at /api/v1/channels/)."""
from django.urls import path

from . import views

app_name = "channels"

urlpatterns = [
    path("", views.ChannelListCreateView.as_view(), name="list_create"),
    path("<uuid:channel_id>/subscribe", views.ChannelSubscribeView.as_view(), name="subscribe"),
    path("<uuid:channel_id>/members/<uuid:user_id>/promote", views.ChannelPromoteView.as_view(), name="promote"),
    path("<uuid:channel_id>/posts", views.ChannelPostsView.as_view(), name="posts"),
]

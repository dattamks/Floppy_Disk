"""
Channels API: create/discover/subscribe + role-gated posting.

Only owner/admin can post. The owner can promote a subscriber to admin
("grant posting rights"). Public channels are discoverable; private are not.
"""
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Channel, ChannelMembership, ChannelPost
from .serializers import ChannelCreateSerializer, ChannelPostSerializer, ChannelSerializer


def _membership(channel, user):
    return ChannelMembership.objects.filter(channel=channel, user=user).first()


class ChannelListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """?mine=1 -> channels I belong to; otherwise discover public channels."""
        if request.query_params.get("mine"):
            qs = Channel.objects.filter(memberships__user=request.user).distinct()
        else:
            qs = Channel.objects.filter(is_public=True)
        qs = qs.prefetch_related("memberships").order_by("-created_at")
        return Response(ChannelSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = ChannelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        channel = serializer.save(owner=request.user)
        ChannelMembership.objects.create(
            channel=channel, user=request.user, role=ChannelMembership.Role.OWNER
        )
        return Response(
            ChannelSerializer(channel, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ChannelSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, channel_id):
        try:
            channel = Channel.objects.get(pk=channel_id)
        except Channel.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not channel.is_public and _membership(channel, request.user) is None:
            return Response({"detail": "This channel is invite-only."}, status=status.HTTP_403_FORBIDDEN)
        ChannelMembership.objects.get_or_create(
            channel=channel, user=request.user,
            defaults={"role": ChannelMembership.Role.SUBSCRIBER},
        )
        return Response(ChannelSerializer(channel, context={"request": request}).data)

    def delete(self, request, channel_id):
        m = ChannelMembership.objects.filter(channel_id=channel_id, user=request.user).first()
        if m is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if m.role == ChannelMembership.Role.OWNER:
            return Response({"detail": "The owner cannot unsubscribe."}, status=status.HTTP_400_BAD_REQUEST)
        m.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelPromoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, channel_id, user_id):
        try:
            channel = Channel.objects.get(pk=channel_id)
        except Channel.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if channel.owner_id != request.user.id:
            return Response({"detail": "Only the owner can grant posting rights."}, status=status.HTTP_403_FORBIDDEN)
        target = ChannelMembership.objects.filter(channel=channel, user_id=user_id).first()
        if target is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        target.role = ChannelMembership.Role.ADMIN
        target.save(update_fields=["role", "updated_at"])
        return Response({"role": target.role})


class ChannelPostsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, channel_id):
        try:
            channel = Channel.objects.get(pk=channel_id)
        except Channel.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not channel.is_public and _membership(channel, request.user) is None:
            return Response(status=status.HTTP_403_FORBIDDEN)
        posts = channel.posts.order_by("-created_at")
        return Response(ChannelPostSerializer(posts, many=True).data)

    def post(self, request, channel_id):
        try:
            channel = Channel.objects.get(pk=channel_id)
        except Channel.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        membership = _membership(channel, request.user)
        if membership is None or not membership.can_post:
            return Response(
                {"detail": "Only owners and admins can post to this channel."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ChannelPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = ChannelPost.objects.create(
            channel=channel, author=request.user,
            caption=serializer.validated_data.get("caption", ""),
            file=serializer.validated_data.get("file"),
        )
        return Response(ChannelPostSerializer(post).data, status=status.HTTP_201_CREATED)

"""Notifications API: list + unread count, mark read, mark all read."""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user).order_by("-created_at")[:100]
        unread = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({
            "unread_count": unread,
            "results": NotificationSerializer(qs, many=True).data,
        })


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        updated = Notification.objects.filter(
            pk=notification_id, user=request.user, is_read=False
        ).update(is_read=True)
        if updated:
            return Response(status=status.HTTP_204_NO_CONTENT)
        # Idempotent: re-marking an already-read notification is a no-op success,
        # not a 404. Only a notification that doesn't exist for this user 404s.
        if Notification.objects.filter(pk=notification_id, user=request.user).exists():
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_404_NOT_FOUND)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)

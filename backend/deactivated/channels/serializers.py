from rest_framework import serializers

from .models import Channel, ChannelPost


class ChannelSerializer(serializers.ModelSerializer):
    subscriber_count = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = Channel
        fields = ["id", "name", "handle", "description", "is_public", "subscriber_count", "role", "created_at"]
        read_only_fields = ["id", "subscriber_count", "role", "created_at"]

    def get_subscriber_count(self, obj):
        return obj.memberships.count()

    def get_role(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return None
        m = next((m for m in obj.memberships.all() if m.user_id == user.id), None)
        return m.role if m else None


class ChannelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = ["id", "name", "handle", "description", "is_public"]
        read_only_fields = ["id"]

    def validate_handle(self, value):
        value = value.strip().lstrip("@").lower()
        if not value:
            raise serializers.ValidationError("Handle cannot be empty.")
        if Channel.objects.filter(handle=value).exists():
            raise serializers.ValidationError("That handle is taken.")
        return value


class ChannelPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChannelPost
        fields = ["id", "channel", "caption", "file", "created_at"]
        read_only_fields = ["id", "channel", "created_at"]

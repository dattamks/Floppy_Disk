"""DRF serializers for the storage API."""
from rest_framework import serializers

from .models import File, Folder
from .services.base import get_storage_service


class FolderSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Folder
        fields = ["id", "name", "parent", "item_count", "created_at"]
        read_only_fields = ["id", "item_count", "created_at"]

    def get_item_count(self, obj):
        return obj.files.filter(deleted_at__isnull=True, status=File.Status.READY).count()


class FolderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ["id", "name", "parent"]
        read_only_fields = ["id"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Folder name cannot be empty.")
        return value

    def validate_parent(self, value):
        # A parent must belong to the requesting user.
        if value is not None:
            user = self.context["request"].user
            if value.owner_id != user.id or value.deleted_at is not None:
                raise serializers.ValidationError("Invalid parent folder.")
        return value


class FileSerializer(serializers.ModelSerializer):
    poster_url = serializers.SerializerMethodField()

    class Meta:
        model = File
        fields = [
            "id", "name", "folder", "kind", "size_bytes", "status", "created_at",
            "poster_url", "duration_seconds",
        ]
        read_only_fields = fields

    def get_poster_url(self, obj):
        # Video poster frame (generated during transcode), for grid thumbnails.
        if obj.poster_object_id:
            p = obj.poster_object
            return get_storage_service().presign_download(region=p.region, object_key=p.object_key)
        return None


class UploadInitiateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    size_bytes = serializers.IntegerField(min_value=1)
    folder = serializers.PrimaryKeyRelatedField(
        queryset=Folder.objects.all(), required=False, allow_null=True
    )
    kind = serializers.ChoiceField(choices=File.Kind.choices, default=File.Kind.FILE)

    def validate_folder(self, value):
        if value is not None:
            user = self.context["request"].user
            if value.owner_id != user.id or value.deleted_at is not None:
                raise serializers.ValidationError("Invalid folder.")
        return value

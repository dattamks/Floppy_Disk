from rest_framework import serializers

from .models import ShareLink


class ShareLinkSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    has_password = serializers.BooleanField(read_only=True)
    target_name = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()

    class Meta:
        model = ShareLink
        fields = ["id", "token", "url", "has_password", "expires_at", "revoked",
                  "target_name", "target_id", "created_at"]
        read_only_fields = fields

    def get_url(self, obj):
        return f"/s/{obj.token}"

    def get_target_id(self, obj):
        # The id of the file/folder this link points at, so the client can mark
        # it as "shared" in the Shared view.
        return str(obj.file_id or obj.folder_id or "") or None

    def get_target_name(self, obj):
        if obj.file_id:
            return obj.file.name
        if obj.folder_id:
            return obj.folder.name
        return ""

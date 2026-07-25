from rest_framework import serializers

from .models import ContentReport


class ContentReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentReport
        fields = ["id", "kind", "target_type", "target_id", "reason", "detail", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        # Copyright reports require the reporter to identify themselves (DMCA-style).
        if attrs.get("reason") == ContentReport.Reason.COPYRIGHT and not attrs.get("detail"):
            raise serializers.ValidationError(
                {"detail": "Copyright reports must include your name and a statement."}
            )
        return attrs

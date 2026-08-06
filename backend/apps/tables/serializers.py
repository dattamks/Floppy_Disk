"""DRF serializers for the tables API."""
from rest_framework import serializers

from .models import Field, Row, Table, View


class FieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = Field
        fields = ["id", "name", "type", "options", "position", "is_primary"]
        read_only_fields = ["id", "is_primary"]


class ViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = View
        fields = ["id", "name", "kind", "config", "position"]
        read_only_fields = ["id", "kind"]


class RowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Row
        fields = ["id", "data", "position", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class TableSerializer(serializers.ModelSerializer):
    """Bare table row (for listings)."""

    row_count = serializers.SerializerMethodField()

    class Meta:
        model = Table
        fields = ["id", "name", "folder", "row_count", "created_at", "updated_at", "deleted_at"]
        read_only_fields = fields

    def get_row_count(self, obj):
        # Annotated in the list query when available; falls back to a count.
        n = getattr(obj, "_row_count", None)
        return n if n is not None else obj.rows.count()


class TableDetailSerializer(TableSerializer):
    """Full schema for opening a table: its fields and views (rows load separately)."""

    fields = FieldSerializer(many=True, read_only=True)
    views = ViewSerializer(many=True, read_only=True)

    class Meta(TableSerializer.Meta):
        fields = TableSerializer.Meta.fields + ["fields", "views"]
        read_only_fields = fields

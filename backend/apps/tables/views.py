"""REST API for structured tables.

Auth: session (owner UI) or Bearer API key (integrations/MCP), same as storage.
Every access is owner-filtered and folder-scoped, so a folder-scoped key can
only reach tables inside its subtree.
"""
from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .logic import coerce_row_data, coerce_value, next_position, provision_default_table
from .models import Field, Row, Table, View
from .scoping import folder_in_scope, scope_tables
from .serializers import (
    FieldSerializer,
    RowSerializer,
    TableDetailSerializer,
    TableSerializer,
    ViewSerializer,
)


def _get_table(request, table_id, *, include_trashed=False):
    """Fetch a table the request may touch (owner + folder scope), or None."""
    qs = Table.objects.filter(pk=table_id, owner=request.user)
    if not include_trashed:
        qs = qs.filter(deleted_at__isnull=True)
    return scope_tables(qs, request).first()


class TableListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        trashed = request.query_params.get("trashed") in ("1", "true", "yes")
        qs = Table.objects.filter(owner=request.user)
        qs = qs.filter(deleted_at__isnull=False) if trashed else qs.filter(deleted_at__isnull=True)
        qs = scope_tables(qs, request).annotate(_row_count=Count("rows")).order_by("-updated_at")
        return Response(TableSerializer(qs, many=True).data)

    def post(self, request):
        name = (request.data.get("name") or "Untitled table").strip()[:255] or "Untitled table"
        folder_id = request.data.get("folder") or None
        if not folder_in_scope(request, folder_id):
            return Response({"detail": "This key can only create tables inside its allowed folder."},
                            status=status.HTTP_400_BAD_REQUEST)
        folder = None
        if folder_id:
            from apps.storage.models import Folder
            folder = Folder.objects.filter(
                pk=folder_id, owner=request.user, deleted_at__isnull=True
            ).first()
            if folder is None:
                return Response({"detail": "Invalid folder."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            table = Table.objects.create(owner=request.user, name=name, folder=folder)
            provision_default_table(table)
        return Response(TableDetailSerializer(table).data, status=status.HTTP_201_CREATED)


class TableDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, table_id):
        table = _get_table(request, table_id)
        if table is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(TableDetailSerializer(table).data)

    def patch(self, request, table_id):
        # Allow acting on a trashed table only to restore it.
        restoring = bool(request.data.get("restore"))
        table = _get_table(request, table_id, include_trashed=restoring)
        if table is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        fields = []
        if restoring:
            table.deleted_at = None
            table.trashed_root = None
            fields += ["deleted_at", "trashed_root"]
        if "name" in request.data:
            name = (request.data.get("name") or "").strip()[:255]
            if not name:
                return Response({"detail": "Table name cannot be empty."},
                                status=status.HTTP_400_BAD_REQUEST)
            table.name = name
            fields.append("name")
        if "folder" in request.data:
            folder_id = request.data.get("folder") or None
            if not folder_in_scope(request, folder_id):
                return Response({"detail": "Destination is outside this key's allowed folder."},
                                status=status.HTTP_400_BAD_REQUEST)
            folder = None
            if folder_id:
                from apps.storage.models import Folder
                folder = Folder.objects.filter(
                    pk=folder_id, owner=request.user, deleted_at__isnull=True
                ).first()
                if folder is None:
                    return Response({"detail": "Invalid destination folder."},
                                    status=status.HTTP_400_BAD_REQUEST)
            table.folder = folder
            fields.append("folder")
        if fields:
            table.save(update_fields=[*fields, "updated_at"])
        return Response(TableDetailSerializer(table).data)

    def delete(self, request, table_id):
        table = _get_table(request, table_id)
        if table is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        table.deleted_at = timezone.now()
        table.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------- fields
class FieldListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, table_id):
        table = _get_table(request, table_id)
        if table is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        name = (request.data.get("name") or "Field").strip()[:255] or "Field"
        ftype = request.data.get("type") or Field.Type.TEXT
        if ftype not in Field.Type.values:
            return Response({"detail": "Unknown field type."}, status=status.HTTP_400_BAD_REQUEST)
        field = Field.objects.create(
            table=table, name=name, type=ftype,
            options=request.data.get("options") or {},
            position=next_position(table.fields.all()),
        )
        return Response(FieldSerializer(field).data, status=status.HTTP_201_CREATED)


class FieldDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, field_id):
        field = Field.objects.filter(pk=field_id, table__owner=request.user).select_related("table").first()
        if field is None or _get_table(request, field.table_id) is None:
            return None
        return field

    def patch(self, request, field_id):
        field = self._get(request, field_id)
        if field is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        for attr in ("name", "options", "position"):
            if attr in request.data:
                setattr(field, attr, request.data[attr] if attr != "name"
                        else (request.data["name"] or field.name).strip()[:255])
        if "type" in request.data and request.data["type"] in Field.Type.values:
            field.type = request.data["type"]
        field.save()
        return Response(FieldSerializer(field).data)

    def delete(self, request, field_id):
        field = self._get(request, field_id)
        if field is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if field.is_primary:
            return Response({"detail": "The primary field cannot be deleted."},
                            status=status.HTTP_400_BAD_REQUEST)
        table = field.table
        field.delete()
        table.save(update_fields=["updated_at"])  # invalidate the graph
        return Response(status=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------------- rows
class RowListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, table_id):
        table = _get_table(request, table_id)
        if table is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        rows = table.rows.all()
        return Response(RowSerializer(rows, many=True).data)

    def post(self, request, table_id):
        table = _get_table(request, table_id)
        if table is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        data = coerce_row_data(list(table.fields.all()), request.data.get("data") or {})
        row = Row.objects.create(table=table, data=data, position=next_position(table.rows.all()))
        table.save(update_fields=["updated_at"])  # touch so the table sorts as recent
        return Response(RowSerializer(row).data, status=status.HTTP_201_CREATED)


class RowBulkDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, table_id):
        """Delete many rows at once (bulk row-selection -> delete)."""
        table = _get_table(request, table_id)
        if table is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ids = request.data.get("ids") or []
        if not isinstance(ids, list):
            return Response({"detail": "ids must be a list."}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = Row.objects.filter(table=table, pk__in=ids).delete()
        if deleted:
            table.save(update_fields=["updated_at"])
        return Response({"deleted": deleted})


class RowDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, row_id):
        row = Row.objects.filter(pk=row_id, table__owner=request.user).select_related("table").first()
        if row is None or _get_table(request, row.table_id) is None:
            return None
        return row

    def patch(self, request, row_id):
        row = self._get(request, row_id)
        if row is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if "data" in request.data:
            # Merge cell-by-cell; an explicit null/empty clears that cell.
            fields = {str(f.id): f for f in row.table.fields.all()}
            merged = dict(row.data or {})
            for fid, val in (request.data["data"] or {}).items():
                f = fields.get(str(fid))
                if f is None:
                    continue
                cv = coerce_value(f, val)
                if cv is None:
                    merged.pop(str(fid), None)
                else:
                    merged[str(fid)] = cv
            row.data = merged
        if "position" in request.data:
            try:
                row.position = float(request.data["position"])
            except (TypeError, ValueError):
                pass
        row.save()
        row.table.save(update_fields=["updated_at"])
        return Response(RowSerializer(row).data)

    def delete(self, request, row_id):
        row = self._get(request, row_id)
        if row is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        table = row.table
        row.delete()
        table.save(update_fields=["updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------- views
class ViewDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, view_id):
        view = View.objects.filter(pk=view_id, table__owner=request.user).select_related("table").first()
        if view is None or _get_table(request, view.table_id) is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        for attr in ("name", "config", "position"):
            if attr in request.data:
                setattr(view, attr, request.data[attr])
        view.save()
        return Response(ViewSerializer(view).data)

"""Structured tables - a first-class entity alongside files, folders, and notes.

A Table is a user-defined grid: typed columns (Field) and rows whose cell values
live in a single JSON blob keyed by field id (no runtime DDL, portable across
Postgres JSONB and SQLite JSON). Views hold per-view presentation (visible
fields, order, widths, filters, sorts). Tables slot into the existing folder
tree via an optional `folder`, so folder-scoped API keys confine to them exactly
like files.

Ordering uses a float `position` so an item can be dropped between two others
without renumbering siblings (fractional indexing).
"""
from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class Table(BaseModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tables")
    # Optional placement in the folder tree (drives folder-scoped API-key access).
    folder = models.ForeignKey(
        "storage.Folder", null=True, blank=True, on_delete=models.SET_NULL, related_name="tables"
    )
    name = models.CharField(max_length=255)
    deleted_at = models.DateTimeField(null=True, blank=True)
    # Set when trashed as part of trashing an ancestor folder (that folder's id).
    trashed_root = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "tables_table"
        indexes = [models.Index(fields=["owner", "folder", "deleted_at"])]

    def __str__(self):
        return self.name


class Field(BaseModel):
    """A typed column. `options` carries per-type config (e.g. select choices)."""

    class Type(models.TextChoices):
        TEXT = "text", "Text"
        LONG_TEXT = "long_text", "Long text"
        NUMBER = "number", "Number"
        CHECKBOX = "checkbox", "Checkbox"
        SINGLE_SELECT = "single_select", "Single select"
        DATE = "date", "Date"

    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name="fields")
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.TEXT)
    # e.g. {"choices": [{"id": "...", "name": "Todo", "color": "#..."}], "precision": 2}
    options = models.JSONField(default=dict, blank=True)
    position = models.FloatField(default=0)
    # The primary column: the row's title, always first, never deleted.
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "tables_field"
        ordering = ["position", "created_at"]

    def __str__(self):
        return f"{self.name} ({self.type})"


class Row(BaseModel):
    """One record. Cell values live in `data`, keyed by str(field_id)."""

    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name="rows")
    data = models.JSONField(default=dict, blank=True)
    position = models.FloatField(default=0)

    class Meta:
        db_table = "tables_row"
        ordering = ["position", "created_at"]
        indexes = [models.Index(fields=["table", "position"])]


class View(BaseModel):
    """Saved presentation of a table (Grid for now; Kanban/Gallery/Calendar later)."""

    class Kind(models.TextChoices):
        GRID = "grid", "Grid"

    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name="views")
    name = models.CharField(max_length=255, default="Grid")
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.GRID)
    # {"widths": {field_id: px}, "hidden": [field_id], "filters": [...], "sorts": [...]}
    config = models.JSONField(default=dict, blank=True)
    position = models.FloatField(default=0)

    class Meta:
        db_table = "tables_view"
        ordering = ["position", "created_at"]

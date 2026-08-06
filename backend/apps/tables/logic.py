"""Cell-value coercion + new-table provisioning.

Keeps type handling in one place: every write of a row's cells passes through
`coerce_value` so what lands in the JSON blob is normalized and safe to render.
"""
from __future__ import annotations

import uuid

from .models import Field, Row, Table, View


def next_position(qs) -> float:
    """One past the current max position (append to the end)."""
    from django.db.models import Max

    return (qs.aggregate(m=Max("position"))["m"] or 0.0) + 1.0


def coerce_value(field: Field, value):
    """Normalize a single cell value for a field's type, or None if empty/invalid."""
    if value is None or value == "":
        return None
    t = field.type
    if t in (Field.Type.TEXT, Field.Type.LONG_TEXT):
        return str(value)
    if t == Field.Type.NUMBER:
        try:
            num = float(value)
        except (TypeError, ValueError):
            return None
        return int(num) if num.is_integer() else num
    if t == Field.Type.CHECKBOX:
        return bool(value) and value not in ("false", "0", 0)
    if t == Field.Type.DATE:
        # Store the ISO string as given (YYYY-MM-DD); light-touch validation.
        return str(value)[:32]
    if t == Field.Type.SINGLE_SELECT:
        valid = {c.get("id") for c in field.options.get("choices", [])}
        return str(value) if str(value) in valid else None
    return str(value)


def coerce_row_data(fields, data: dict) -> dict:
    """Coerce a {field_id: value} dict against the table's fields, dropping
    unknown field ids and null results."""
    by_id = {str(f.id): f for f in fields}
    out = {}
    for fid, val in (data or {}).items():
        f = by_id.get(str(fid))
        if f is None:
            continue
        cv = coerce_value(f, val)
        if cv is not None:
            out[str(fid)] = cv
    return out


def provision_default_table(table: Table) -> None:
    """Give a brand-new table a usable starting shape: a primary Name column, a
    couple of typed columns, a default Grid view, and a few empty rows - so the
    grid never opens completely blank."""
    c1, c2, c3 = (uuid.uuid4().hex[:8] for _ in range(3))
    Field.objects.create(table=table, name="Name", type=Field.Type.TEXT, position=1, is_primary=True)
    Field.objects.create(table=table, name="Notes", type=Field.Type.LONG_TEXT, position=2)
    Field.objects.create(
        table=table, name="Status", type=Field.Type.SINGLE_SELECT, position=3,
        options={"choices": [
            {"id": c1, "name": "Todo", "color": "#E5E7EC"},
            {"id": c2, "name": "In progress", "color": "#DBEAFE"},
            {"id": c3, "name": "Done", "color": "#DCFCE7"},
        ]},
    )
    View.objects.create(table=table, name="Grid", kind=View.Kind.GRID, position=1)
    for i in range(3):
        Row.objects.create(table=table, data={}, position=float(i + 1))

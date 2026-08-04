"""
BasicSearchService - portable substring search (dev/test; works on SQLite).

Scope: the user's own files plus other users' *discoverable*,
non-mature content. Always excludes trashed and not-yet-ready files.
Production uses PostgresSearchService (ranked full-text); this is the drop-in
that keeps dev + tests DB-agnostic.
"""
from __future__ import annotations

from django.db.models import Q, TextField
from django.db.models.functions import Cast

from .base import SearchService


class BasicSearchService(SearchService):
    def index(self, *, doc_id, doc_type, fields):
        return None

    def remove(self, *, doc_id):
        return None

    def search(self, *, query, user_id, limit=50, offset=0, folder_ids=None):
        from apps.storage.models import File

        query = (query or "").strip()
        if not query:
            return []

        base = File.objects.filter(deleted_at__isnull=True, status=File.Status.READY)
        if folder_ids is not None:
            # Folder-scoped key: only the owner's files inside the allowed
            # subtree - never other users' discoverable content.
            base = base.filter(owner_id=user_id, folder_id__in=folder_ids)
        else:
            base = base.filter(
                Q(owner_id=user_id)  # your own files (any discoverability)
                | Q(is_discoverable=True, is_mature_content=False)  # others' discoverable, non-mature
            )
        # Match the filename, extracted document text (full-text search), or the
        # user-authored description / tags. Tags are a JSON list, so match against
        # its text form (portable across SQLite and Postgres).
        visible = base.annotate(tags_text=Cast("tags", TextField())).filter(
            Q(name__icontains=query)
            | Q(content_text__icontains=query)
            | Q(description__icontains=query)
            | Q(tags_text__icontains=query)
        ).order_by("-created_at")

        results = []
        for f in visible[offset:offset + limit]:
            results.append({
                "id": str(f.id), "name": f.name, "kind": f.kind,
                "size_bytes": f.size_bytes, "is_own": f.owner_id == user_id,
                "is_discoverable": f.is_discoverable,
            })
        return results

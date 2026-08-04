"""PostgresSearchService - production SearchService using Postgres full-text search."""
from __future__ import annotations

from django.db.models import Q, TextField
from django.db.models.functions import Cast

from .base import SearchService


class PostgresSearchService(SearchService):
    def index(self, *, doc_id, doc_type, fields):
        # Postgres FTS derives its index from the query-time SearchVector below,
        # so explicit indexing is a no-op (kept for the OpenSearch swap).
        return None

    def remove(self, *, doc_id):
        return None

    def search(self, *, query, user_id, limit=50, offset=0, folder_ids=None):
        from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

        from apps.storage.models import File

        query = (query or "").strip()
        if not query:
            return []

        # Weight the filename above the body so name matches rank first; the
        # document text and user-authored description are searchable too.
        vector = (
            SearchVector("name", weight="A")
            + SearchVector("content_text", weight="B")
            + SearchVector("description", weight="C")
        )
        sq = SearchQuery(query, search_type="websearch")
        base = File.objects.filter(deleted_at__isnull=True, status=File.Status.READY)
        if folder_ids is not None:
            # Folder-scoped key: only the owner's files inside the allowed
            # subtree - never other users' discoverable content.
            base = base.filter(owner_id=user_id, folder_id__in=folder_ids)
        else:
            base = base.filter(Q(owner_id=user_id) | Q(is_discoverable=True, is_mature_content=False))
        # Tags are a JSON list; match them by text form so a tag-only hit still
        # surfaces even though it carries no FTS rank.
        visible = (
            base.annotate(rank=SearchRank(vector, sq), tags_text=Cast("tags", TextField()))
            .filter(Q(rank__gt=0) | Q(tags_text__icontains=query))
            .order_by("-rank", "-created_at")
        )
        return [
            {"id": str(f.id), "name": f.name, "kind": f.kind, "size_bytes": f.size_bytes,
             "is_own": f.owner_id == user_id, "is_discoverable": f.is_discoverable}
            for f in visible[offset:offset + limit]
        ]

"""PostgresSearchService — production SearchService using Postgres full-text search."""
from __future__ import annotations

from django.db.models import Q

from .base import SearchService


class PostgresSearchService(SearchService):
    def index(self, *, doc_id, doc_type, fields):
        # Postgres FTS derives its index from the query-time SearchVector below,
        # so explicit indexing is a no-op (kept for the OpenSearch swap).
        return None

    def remove(self, *, doc_id):
        return None

    def search(self, *, query, user_id, limit=50, offset=0):
        from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

        from apps.storage.models import File

        query = (query or "").strip()
        if not query:
            return []

        vector = SearchVector("name")
        sq = SearchQuery(query, search_type="websearch")
        visible = (
            File.objects.filter(
                deleted_at__isnull=True, status=File.Status.READY,
            )
            .filter(Q(owner_id=user_id) | Q(is_discoverable=True, is_mature_content=False))
            .annotate(rank=SearchRank(vector, sq))
            .filter(rank__gt=0)
            .order_by("-rank", "-created_at")
        )
        return [
            {"id": str(f.id), "name": f.name, "kind": f.kind, "size_bytes": f.size_bytes,
             "is_own": f.owner_id == user_id, "is_discoverable": f.is_discoverable}
            for f in visible[offset:offset + limit]
        ]

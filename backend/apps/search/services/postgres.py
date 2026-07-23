"""PostgresSearchService — Phase 1 SearchService using Postgres FTS (stub)."""
from __future__ import annotations

from .base import SearchService


class PostgresSearchService(SearchService):
    def index(self, *, doc_id, doc_type, fields) -> None:
        # Postgres FTS derives its index from a SearchVectorField on the model;
        # explicit index() is mostly a no-op here, present for the OpenSearch swap.
        return None

    def remove(self, *, doc_id) -> None:
        return None

    def search(self, *, query, user_id, limit=50, offset=0) -> list:
        raise NotImplementedError("Wired in the discovery/search slice (SearchVector + rank).")

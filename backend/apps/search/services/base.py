"""
SearchService abstraction — Postgres full-text search now, OpenSearch later.

Scope is enforced by the caller (personal + discoverable only); this interface
just executes the query behind whichever engine is configured
(settings.SEARCH_SERVICE).
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class SearchService(ABC):
    @abstractmethod
    def index(self, *, doc_id: str, doc_type: str, fields: dict) -> None:
        """Add/update a searchable document."""

    @abstractmethod
    def remove(self, *, doc_id: str) -> None:
        """Remove a document from the index."""

    @abstractmethod
    def search(self, *, query: str, user_id: str, limit: int = 50, offset: int = 0,
               folder_ids=None) -> list:
        """Return ranked results the user is allowed to see (personal + discoverable).

        `folder_ids` (a set/list) confines results to those folders — used by
        folder-scoped API keys so a scoped key only searches its own subtree
        (and never other users' discoverable content). None = unrestricted.
        """


def get_search_service() -> "SearchService":
    from django.conf import settings
    from django.utils.module_loading import import_string

    return import_string(settings.SEARCH_SERVICE)()

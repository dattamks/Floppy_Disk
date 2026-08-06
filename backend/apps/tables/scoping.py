"""Folder scoping for tables - reuses the storage chokepoint so a folder-scoped
API key confines to tables in its subtree exactly like it does for files."""
from apps.storage.scoping import folder_in_scope, scoped_folder_ids  # noqa: F401 (re-export)


def scope_tables(qs, request):
    """Restrict a Table queryset to the request's visible folders."""
    ids = scoped_folder_ids(request)
    if ids is None:
        return qs
    return qs.filter(folder_id__in=ids)

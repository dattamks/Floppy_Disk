"""Graph API - read the knowledge graph (scoped) and trigger a rebuild."""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .build import ensure_fresh, rebuild_user_graph
from .read import graph_json, graph_search, related_to_file


class GraphView(APIView):
    """The whole graph the caller may see, as GraphRAG-ready graph.json."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_fresh(request.user)  # build once on first read (dev/personal scale)
        return Response(graph_json(request.user, request))


class GraphRelatedView(APIView):
    """Neighbors of a file in the graph (scoped) - 'what relates to this file?'."""

    permission_classes = [IsAuthenticated]

    def get(self, request, file_id):
        ensure_fresh(request.user)
        result = related_to_file(request.user, request, file_id)
        if result is None:
            return Response({"detail": "No graph node for this file."}, status=404)
        return Response(result)


class GraphSearchView(APIView):
    """Graph-aware search: name matches, each with their in-scope neighbors."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_fresh(request.user)
        return Response(graph_search(request.user, request, request.query_params.get("q", "")))


class GraphRebuildView(APIView):
    """Force a full rebuild of the caller's graph. Full-access keys/session only
    (a folder-scoped key can't trigger a global rebuild it can't fully see)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.storage.scoping import is_scoped
        if is_scoped(request):
            return Response({"detail": "A folder-scoped key cannot rebuild the whole graph."},
                            status=403)
        counts = rebuild_user_graph(request.user)
        return Response(counts)

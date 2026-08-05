"""
Knowledge-graph layer over a user's storage.

A deterministic, LLM-free graph that turns files and folders into a queryable
knowledge graph so AIs/automation (via REST or MCP) get better context on what's
in the store and how it relates. It mirrors Graphify's contract: nodes plus
typed edges, every edge tagged with provenance (EXTRACTED = explicit in the
source, INFERRED = derived by us), and it exports a GraphRAG-ready graph.json.

Scoping: the graph is *built* globally over all of a user's files (so it
captures every relationship), but *read* through the same folder-scope filter as
the file store (apps.storage.scoping). Each node records the folder it lives in
(`scope_folder_id`), so a folder-scoped API key only ever sees nodes inside its
subtree, and an edge is only visible when BOTH endpoints are - cross-scope edges
are clipped at the boundary. Building is trusted; reading is scoped.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class NodeKind(models.TextChoices):
    FILE = "file", "File"
    FOLDER = "folder", "Folder"


class Provenance(models.TextChoices):
    EXTRACTED = "extracted", "Extracted"   # explicit in the source (e.g. containment)
    INFERRED = "inferred", "Inferred"      # derived by us (e.g. shared name token)
    AMBIGUOUS = "ambiguous", "Ambiguous"   # derived but low confidence


class GraphNode(TimeStampedModel):
    """One node per live File or Folder."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="graph_nodes")
    kind = models.CharField(max_length=8, choices=NodeKind.choices)
    # Exactly one of these is set, matching `kind`.
    file = models.ForeignKey("storage.File", null=True, blank=True, on_delete=models.CASCADE, related_name="graph_nodes")
    folder = models.ForeignKey("storage.Folder", null=True, blank=True, on_delete=models.CASCADE, related_name="graph_nodes")
    label = models.CharField(max_length=255)
    node_type = models.CharField(max_length=16, default="file")  # file kind (doc/image/...) or "folder"
    # The folder this node lives in, used for scope filtering:
    #   file-node  -> file.folder_id   (None if the file is at the storage root)
    #   folder-node -> the folder's own id
    # A folder-scoped key sees a node iff scope_folder_id is in its subtree.
    scope_folder_id = models.UUIDField(null=True, blank=True, db_index=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "graph_node"
        indexes = [models.Index(fields=["owner", "kind"])]
        constraints = [
            models.UniqueConstraint(fields=["owner", "file"], name="uniq_node_per_file",
                                    condition=models.Q(file__isnull=False)),
            models.UniqueConstraint(fields=["owner", "folder"], name="uniq_node_per_folder",
                                    condition=models.Q(folder__isnull=False)),
        ]

    def __str__(self):
        return f"{self.kind}:{self.label}"


class GraphEdge(TimeStampedModel):
    """A typed, provenance-tagged relationship between two nodes."""

    class Rel(models.TextChoices):
        CONTAINS = "contains", "Contains"          # folder -> child (EXTRACTED)
        REFERENCES = "references", "References"     # file -> file it names (EXTRACTED)
        SHARED_TOKEN = "shared_token", "Shared token"  # sibling files sharing a name token (INFERRED)
        SHARED_TAG = "shared_tag", "Shared tag"    # files sharing a user-applied tag (INFERRED)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="graph_edges")
    source = models.ForeignKey(GraphNode, on_delete=models.CASCADE, related_name="out_edges")
    target = models.ForeignKey(GraphNode, on_delete=models.CASCADE, related_name="in_edges")
    rel = models.CharField(max_length=20, choices=Rel.choices)
    provenance = models.CharField(max_length=10, choices=Provenance.choices, default=Provenance.EXTRACTED)
    # Human-readable "why this edge exists" - Graphify-style explainability.
    reason = models.CharField(max_length=255, blank=True, default="")
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "graph_edge"
        indexes = [models.Index(fields=["owner", "rel"])]
        constraints = [
            models.UniqueConstraint(fields=["source", "target", "rel"], name="uniq_edge"),
        ]

    def __str__(self):
        return f"{self.source_id} -{self.rel}-> {self.target_id}"


class GraphBuild(TimeStampedModel):
    """Per-user build marker (when the graph was last rebuilt, and its size)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="graph_build")
    built_at = models.DateTimeField(null=True, blank=True)
    node_count = models.PositiveIntegerField(default=0)
    edge_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "graph_build"

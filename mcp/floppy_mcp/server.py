"""Floppy Disk MCP server (FastMCP).

Exposes the Floppy Disk cloud-storage API as MCP tools so MCP-aware clients
(Claude Code, n8n, Codex/OpenAI, etc.) can do everything a user does: manage
folders and files, upload and download media, share links, and read
notifications.

Aligned with the MCP 2026-07-28 spec:

* **Stateless core.** The server runs with `stateless_http=True` - no
  `initialize` handshake, no `Mcp-Session-Id`, no per-session state. Every tool
  is a single, self-contained REST call under the caller's Bearer key, so
  requests are independent and the server scales horizontally. The stateless
  request framing, `MCP-Protocol-Version` negotiation, header routing
  (`Mcp-Method`/`Mcp-Name`), and cacheable list directives are implemented by
  the SDK transport layer; the tool definitions below stay transport-agnostic.
* **Streamable HTTP, no legacy SSE.** Remote clients use the `streamable-http`
  transport; the deprecated HTTP+SSE transport is not offered.
* **No deprecated server-initiated features.** The server uses none of Roots,
  Sampling, or Logging, so it needs no MRTR (multi-round-trip) fallbacks - tool
  calls never open a server->client stream.
* **Auth.** Bearer API key (see below). We deliberately do not run an OAuth
  flow, so the 2026-07-28 OAuth hardening (RFC 9207 `iss`, CIMD) does not apply;
  a folder-scoped key additionally confines every tool to one folder subtree.

Auth: set FLOPPY_API_KEY (a Bearer API key) and optionally FLOPPY_API_BASE_URL
(default http://localhost:8000/api/v1). Mint a key with
`python manage.py create_api_key <email>`.

Run (local, default):   python -m floppy_mcp.server
Run (remote HTTP):       FLOPPY_MCP_TRANSPORT=streamable-http python -m floppy_mcp.server
"""
from __future__ import annotations

import base64
import os
import uuid
from pathlib import Path
from typing import Any, Optional

from fastmcp import FastMCP

from .client import FloppyApiError, FloppyClient


def _uid(value: str, kind: str = "id") -> str:
    """Validate that an id is a UUID before it's interpolated into a request path.

    Without this, an id containing '/' or '?' (hallucinated or hostile) would
    reshape the request path/query under the caller's Bearer key.
    """
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        raise ValueError(f"Invalid {kind}: expected a UUID, got {value!r}")


mcp = FastMCP(
    name="floppy-disk",
    instructions=(
        "Tools for the Floppy Disk cloud-storage platform. Use get_usage to see "
        "quota, list_folders/list_files to browse, upload_file/download_file to "
        "move media, and create_share_link to get a public URL. IDs are UUIDs; "
        "sizes are bytes. Uploading enforces quota and a per-file size cap. If "
        "the API key is folder-scoped, every tool is confined to that folder's "
        "subtree (calls outside it return not-found)."
    ),
)

_client: Optional[FloppyClient] = None


def client() -> FloppyClient:
    """Lazily build the API client (so importing the module needs no env)."""
    global _client
    if _client is None:
        _client = FloppyClient()
    return _client


def _guess_kind(name: str) -> str:
    ext = Path(name).suffix.lower().lstrip(".")
    if ext in {"jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "svg", "tiff"}:
        return "image"
    if ext in {"mp4", "mov", "mkv", "webm", "avi", "m4v"}:
        return "video"
    if ext in {"mp3", "wav", "flac", "aac", "ogg", "m4a"}:
        return "audio"
    return "doc"


# ---------------------------------------------------------------------------
# Account & usage
# ---------------------------------------------------------------------------
@mcp.tool
def whoami() -> dict:
    """Return the authenticated user (email, quota)."""
    return client().get("auth/me")


@mcp.tool
def get_usage() -> dict:
    """Instance-wide storage usage (one shared pool): used_bytes, quota_bytes
    (the total ceiling), available_bytes, backend ("local"/"r2"), and
    over_cap. Read-only - the storage backend and budget cap can be changed
    only by the owner from the web app, never via an API key or MCP."""
    return client().get("storage/usage")


# ---------------------------------------------------------------------------
# Folders
# ---------------------------------------------------------------------------
@mcp.tool
def list_folders(parent_id: Optional[str] = None) -> list:
    """List folders. Pass parent_id to list a folder's children; omit for the top level."""
    params = {"parent": parent_id} if parent_id else None
    return client().get("storage/folders", params=params)


@mcp.tool
def create_folder(name: str, parent_id: Optional[str] = None) -> dict:
    """Create a folder (optionally nested under parent_id). Returns the new folder."""
    payload: dict[str, Any] = {"name": name}
    if parent_id:
        payload["parent"] = parent_id
    return client().post("storage/folders", json=payload)


@mcp.tool
def delete_folder(folder_id: str) -> dict:
    """Soft-delete a folder (moves it to trash)."""
    return client().delete(f"storage/folders/{_uid(folder_id, 'folder_id')}")


@mcp.tool
def restore_folder(folder_id: str) -> dict:
    """Restore a trashed folder (and everything trashed with it)."""
    return client().post(f"storage/folders/{_uid(folder_id, 'folder_id')}/restore")


@mcp.tool
def rename_folder(folder_id: str, name: str) -> dict:
    """Rename a folder. Auto-suffixes " (n)" if the name is taken by a sibling."""
    return client().patch(f"storage/folders/{_uid(folder_id, 'folder_id')}", json={"name": name})


@mcp.tool
def move_folder(folder_id: str, parent_id: Optional[str] = None) -> dict:
    """Move a folder under parent_id (omit/None = root). Rejects moving it into
    itself or its own subtree."""
    return client().patch(f"storage/folders/{_uid(folder_id, 'folder_id')}", json={"parent": parent_id})


@mcp.tool
def purge_folder(folder_id: str) -> dict:
    """Permanently delete a trashed folder and its whole subtree. Cannot be undone."""
    return client().post(f"storage/folders/{_uid(folder_id, 'folder_id')}/purge")


@mcp.tool
def get_camera_backup_folder() -> dict:
    """Get (or create) the user's Camera Backup folder."""
    return client().get("storage/camera-backup")


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------
@mcp.tool
def list_files(folder_id: Optional[str] = None) -> list:
    """List files. Pass folder_id to list a folder's files; omit for the root."""
    params = {"folder": folder_id} if folder_id else None
    return client().get("storage/files", params=params)


@mcp.tool
def delete_file(file_id: str) -> dict:
    """Soft-delete a file (moves it to trash; still counts toward quota until purged)."""
    return client().delete(f"storage/files/{_uid(file_id, 'file_id')}")


@mcp.tool
def restore_file(file_id: str) -> dict:
    """Restore a trashed file."""
    return client().post(f"storage/files/{_uid(file_id, 'file_id')}/restore")


@mcp.tool
def purge_file(file_id: str) -> dict:
    """Permanently delete a trashed file (releases quota). Cannot be undone."""
    return client().post(f"storage/files/{_uid(file_id, 'file_id')}/purge")


@mcp.tool
def rename_file(file_id: str, name: str) -> dict:
    """Rename a file. Auto-suffixes " (n)" (extension preserved) on a collision."""
    return client().patch(f"storage/files/{_uid(file_id, 'file_id')}", json={"name": name})


@mcp.tool
def move_file(file_id: str, folder_id: Optional[str] = None) -> dict:
    """Move a file into folder_id (omit/None = root)."""
    return client().patch(f"storage/files/{_uid(file_id, 'file_id')}", json={"folder": folder_id})


@mcp.tool
def set_file_metadata(
    file_id: str,
    description: Optional[str] = None,
    tags: Optional[list] = None,
) -> dict:
    """Set a file's description and/or tags (searchable, shown in its Details panel).

    Pass only the fields you want to change. `tags` replaces the whole list; it
    accepts a list of strings (or a comma-separated string) and the server trims,
    de-duplicates (case-insensitively), and caps them. Returns the updated file.
    """
    payload: dict = {}
    if description is not None:
        payload["description"] = description
    if tags is not None:
        payload["tags"] = tags
    if not payload:
        raise ValueError("Pass description and/or tags to update.")
    return client().patch(f"storage/files/{_uid(file_id, 'file_id')}", json=payload)


@mcp.tool
def set_file_discoverable(file_id: str, discoverable: bool, mature: bool = False) -> dict:
    """Toggle whether a file is discoverable in search, and its mature flag."""
    return client().post(
        f"storage/files/{_uid(file_id, 'file_id')}/discoverable",
        json={"is_discoverable": discoverable, "is_mature_content": mature},
    )


@mcp.tool
def list_trash() -> dict:
    """List trashed folders and files."""
    return client().get("storage/trash")


@mcp.tool
def search_files(query: str) -> dict:
    """Search your files plus public discoverable (non-mature) files.

    Matches file names, document contents (text/Markdown/JSON/PDF text and OCR'd
    image text, indexed on upload/edit), and the user-authored description/tags.
    Returns {"results": [...]} where each result has id, name, kind, size_bytes,
    is_own, and is_discoverable.
    """
    return client().get("storage/search", params={"q": query})


@mcp.tool
def create_note(
    name: str,
    content: str = "",
    folder_id: Optional[str] = None,
) -> dict:
    """Create a Markdown note in one call and return the ready File.

    A note is a `.md` document (`.md` is appended if missing). Use
    `[[Other note]]` wiki-links to connect notes in the knowledge graph.
    """
    body: dict = {"name": name, "content": content}
    if folder_id:
        body["folder"] = _uid(folder_id, "folder_id")
    return client().post("storage/notes", json=body)


@mcp.tool
def edit_file_content(file_id: str, content: str) -> dict:
    """Replace a text document's contents in place (edit-in-place save).

    For text/Markdown documents (e.g. notes). Returns the updated File; the
    content is re-indexed for search and the knowledge graph is refreshed.
    """
    return client().put(
        f"storage/files/{_uid(file_id, 'file_id')}/content", json={"content": content}
    )


# ---------------------------------------------------------------------------
# Upload / download (the 3-step flow, wrapped as one call)
# ---------------------------------------------------------------------------
@mcp.tool
def upload_file(
    path: str,
    folder_id: Optional[str] = None,
    name: Optional[str] = None,
) -> dict:
    """Upload a local file end-to-end (initiate → PUT bytes → complete).

    `path` is a file on the machine running this MCP server. Returns the ready
    File record. Raises if quota or the per-file size cap is exceeded.
    """
    src = Path(path).expanduser()
    if not src.is_file():
        raise FileNotFoundError(f"No such file: {src}")
    data = src.read_bytes()
    display_name = name or src.name
    c = client()

    init = c.post(
        "storage/uploads",
        json={
            "name": display_name,
            "size_bytes": len(data),
            "kind": _guess_kind(display_name),
            **({"folder": folder_id} if folder_id else {}),
        },
    )
    file_id = init["file"]["id"]
    upload_url = init["upload"]["url"]

    put = c.blob_request(
        "PUT", upload_url, content=data,
        headers={"Content-Type": "application/octet-stream"},
    )
    if put.status_code >= 300:
        raise FloppyApiError(put.status_code, f"blob PUT failed: {put.text[:200]}")

    return c.post(f"storage/uploads/{_uid(file_id, 'file_id')}/complete")


@mcp.tool
def upload_bytes(
    filename: str,
    content_base64: str,
    folder_id: Optional[str] = None,
) -> dict:
    """Upload in-memory content (base64-encoded) as a file. Returns the ready File."""
    data = base64.b64decode(content_base64)
    c = client()
    init = c.post(
        "storage/uploads",
        json={
            "name": filename,
            "size_bytes": len(data),
            "kind": _guess_kind(filename),
            **({"folder": folder_id} if folder_id else {}),
        },
    )
    file_id = init["file"]["id"]
    put = c.blob_request(
        "PUT", init["upload"]["url"], content=data,
        headers={"Content-Type": "application/octet-stream"},
    )
    if put.status_code >= 300:
        raise FloppyApiError(put.status_code, f"blob PUT failed: {put.text[:200]}")
    return c.post(f"storage/uploads/{_uid(file_id, 'file_id')}/complete")


@mcp.tool
def get_download_url(file_id: str) -> dict:
    """Get a URL to fetch a file's bytes (presigned in R2, direct in local mode)."""
    return client().get(f"storage/files/{_uid(file_id, 'file_id')}/download")


@mcp.tool
def download_file(file_id: str, dest_path: str, overwrite: bool = False) -> dict:
    """Download a file's bytes to a local path on the MCP host. Returns {path, size_bytes}.

    Refuses to overwrite an existing file unless overwrite=True, so a mistaken or
    injected dest_path can't clobber host files (e.g. ~/.ssh/authorized_keys).
    """
    c = client()
    dest = Path(dest_path).expanduser()
    if dest.exists() and not overwrite:
        raise FileExistsError(f"{dest} already exists; pass overwrite=True to replace it.")
    info = c.get(f"storage/files/{_uid(file_id, 'file_id')}/download")
    resp = c.blob_request("GET", info["download_url"])
    if resp.status_code >= 300:
        raise FloppyApiError(resp.status_code, f"blob GET failed: {resp.text[:200]}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(resp.content)
    return {"path": str(dest), "size_bytes": len(resp.content), "name": info.get("name")}


# ---------------------------------------------------------------------------
# Video
# ---------------------------------------------------------------------------
@mcp.tool
def get_video_playback(file_id: str) -> dict:
    """Get a direct URL to play an owned video inline.

    Returns {mode: "direct", url, poster?, duration_seconds?}. Video is
    transcoded to a browser-playable MP4 server-side (self-hosted FFmpeg); a
    409 with code "processing" means the transcode hasn't finished yet.
    """
    return client().post(f"storage/files/{_uid(file_id, 'file_id')}/play")


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------
@mcp.tool
def create_share_link(
    file_id: str,
    password: Optional[str] = None,
    expires_at: Optional[str] = None,
) -> dict:
    """Create a public share link for a file.

    `expires_at` is an ISO-8601 datetime (e.g. "2026-12-31T23:59:00Z"); omit for
    a non-expiring link. An optional password protects the link.
    """
    payload: dict[str, Any] = {}
    if password:
        payload["password"] = password
    if expires_at:
        payload["expires_at"] = expires_at
    return client().post(f"storage/files/{_uid(file_id, 'file_id')}/share", json=payload)


@mcp.tool
def list_share_links() -> list:
    """List your active share links."""
    return client().get("storage/shares")


@mcp.tool
def revoke_share_link(share_id: str) -> dict:
    """Revoke a share link."""
    return client().delete(f"storage/shares/{_uid(share_id, 'share_id')}")


# ---------------------------------------------------------------------------
# Knowledge graph (deterministic, LLM-free context surface)
# ---------------------------------------------------------------------------
@mcp.tool
def get_graph() -> dict:
    """Get the storage knowledge graph as GraphRAG-ready graph.json.

    Nodes are files/folders; edges are typed and provenance-tagged ("extracted"
    = explicit like containment, "inferred" = derived like a shared name token),
    each with a plain-language `reason`. Use this to understand how the files
    relate before searching or acting. If the API key is folder-scoped, the graph
    is limited to that folder's subtree (cross-scope edges are clipped).
    """
    return client().get("graph/")


@mcp.tool
def graph_search(query: str) -> dict:
    """Graph-aware search: name matches, each returned with its neighbors in the
    graph, so you get a hit plus its surrounding context in one call."""
    return client().get("graph/search", params={"q": query})


@mcp.tool
def get_related_files(file_id: str) -> dict:
    """What relates to this file in the graph (containing folder, shared-token
    siblings, references) - each edge explained. Scoped like everything else."""
    return client().get(f"graph/related/{_uid(file_id, 'file_id')}")


@mcp.tool
def rebuild_graph() -> dict:
    """Force a full rebuild of the knowledge graph from the current files.

    Normally unnecessary - the graph refreshes itself when files change. A
    folder-scoped key cannot rebuild the whole graph.
    """
    return client().post("graph/rebuild")


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@mcp.tool
def list_notifications() -> dict:
    """List notifications and the unread_count."""
    return client().get("notifications/")


@mcp.tool
def mark_notification_read(notification_id: str) -> dict:
    """Mark one notification as read."""
    return client().post(f"notifications/{_uid(notification_id, 'notification_id')}/read")


@mcp.tool
def mark_all_notifications_read() -> dict:
    """Mark all notifications as read."""
    return client().post("notifications/read-all")


# ---------------------------------------------------------------------------
# Tables (structured data - a first-class entity, like files and notes)
# ---------------------------------------------------------------------------
@mcp.tool
def list_tables() -> list:
    """List your tables (id, name, folder, row_count). Folder-scoped keys see
    only tables inside their subtree."""
    return client().get("tables/")


@mcp.tool
def get_table(table_id: str) -> dict:
    """Get a table's schema: its fields (columns) and views. Call this first -
    row cells are keyed by field id, and this maps each field id to its name and
    type (and a select field's choice ids)."""
    return client().get(f"tables/{_uid(table_id, 'table_id')}")


@mcp.tool
def get_table_rows(table_id: str) -> list:
    """Get a table's rows. Each row is {id, data, ...} where `data` maps field id
    -> cell value; pair it with get_table to resolve field ids to names."""
    return client().get(f"tables/{_uid(table_id, 'table_id')}/rows")


@mcp.tool
def create_table(name: str, folder_id: Optional[str] = None) -> dict:
    """Create a table (with a starter schema). Returns its full schema. A
    folder-scoped key must pass a folder_id inside its subtree."""
    body: dict = {"name": name}
    if folder_id:
        body["folder"] = _uid(folder_id, "folder_id")
    return client().post("tables/", json=body)


@mcp.tool
def create_row(table_id: str, data: Optional[dict] = None) -> dict:
    """Append a row. `data` maps field id -> value (get the field ids from
    get_table); omit it for a blank row. Values are coerced to each field's type,
    and anything invalid is dropped."""
    return client().post(f"tables/{_uid(table_id, 'table_id')}/rows", json={"data": data or {}})


@mcp.tool
def update_row(row_id: str, data: dict) -> dict:
    """Set one or more cells on a row. `data` maps field id -> value; an empty
    value clears that cell. Only the fields you pass are changed."""
    return client().patch(f"tables/rows/{_uid(row_id, 'row_id')}", json={"data": data})


@mcp.tool
def delete_row(row_id: str) -> dict:
    """Delete a row from its table."""
    return client().delete(f"tables/rows/{_uid(row_id, 'row_id')}")


@mcp.tool
def delete_rows(table_id: str, row_ids: list) -> dict:
    """Delete many rows from a table at once. Returns {deleted: n}."""
    ids = [_uid(r, "row_id") for r in row_ids]
    return client().post(f"tables/{_uid(table_id, 'table_id')}/rows/bulk_delete", json={"ids": ids})


@mcp.tool
def add_field(table_id: str, name: str, type: str = "text", options: Optional[dict] = None) -> dict:
    """Add a column. `type` is one of: text, long_text, number, checkbox,
    single_select, date. For single_select pass options={"choices": [{"id","name","color"}]}.
    """
    body: dict = {"name": name, "type": type}
    if options:
        body["options"] = options
    return client().post(f"tables/{_uid(table_id, 'table_id')}/fields", json=body)


def main() -> None:
    """Entry point.

    Transport is chosen by FLOPPY_MCP_TRANSPORT:
      * "stdio" (default) - local clients (Claude Code, Codex) spawn the server
        and talk over stdin/stdout.
      * "streamable-http" (aliases: "http") - remote clients connect over
        Streamable HTTP; host/port from FLOPPY_MCP_HOST / FLOPPY_MCP_PORT.

    The legacy HTTP+SSE transport was deprecated in the MCP 2026-07-28 spec and
    is intentionally not offered.
    """
    transport = os.environ.get("FLOPPY_MCP_TRANSPORT", "stdio").strip().lower()
    if transport == "stdio":
        mcp.run(transport="stdio")
    elif transport in ("http", "streamable-http", "streamable_http"):
        host = os.environ.get("FLOPPY_MCP_HOST", "127.0.0.1")
        port = int(os.environ.get("FLOPPY_MCP_PORT", "8765"))
        # MCP 2026-07-28 stateless core: no session handshake, no Mcp-Session-Id.
        # In fastmcp 3.x stateless_http is a runtime option (not a constructor
        # kwarg); each tool call is an independent, self-contained REST request.
        mcp.run(transport="streamable-http", host=host, port=port, stateless_http=True)
    elif transport == "sse":
        raise SystemExit(
            "The HTTP+SSE transport was deprecated in MCP 2026-07-28 and is not "
            "supported. Set FLOPPY_MCP_TRANSPORT=streamable-http instead."
        )
    else:
        raise SystemExit(
            f"Unknown FLOPPY_MCP_TRANSPORT={transport!r}. "
            "Use 'stdio' (default) or 'streamable-http'."
        )


if __name__ == "__main__":
    main()

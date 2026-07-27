"""Floppy Disk MCP server (FastMCP).

Exposes the Floppy Disk cloud-storage API as MCP tools so MCP-aware clients
(Claude Code, n8n, Codex/OpenAI, etc.) can do everything a user does: manage
folders and files, upload and download media, share links, and read
notifications.

Auth: set FLOPPY_API_KEY (a Bearer API key) and optionally FLOPPY_API_BASE_URL
(default http://localhost:8000/api/v1). Mint a key with
`python manage.py create_api_key <email>`.

Run:  fastmcp run floppy_mcp.server   (or: python -m floppy_mcp.server)
"""
from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Any, Optional

from fastmcp import FastMCP

from .client import FloppyApiError, FloppyClient

mcp = FastMCP(
    name="floppy-disk",
    instructions=(
        "Tools for the Floppy Disk cloud-storage platform. Use get_usage to see "
        "quota, list_folders/list_files to browse, upload_file/download_file to "
        "move media, and create_share_link to get a public URL. IDs are UUIDs; "
        "sizes are bytes. Uploading enforces quota and per-tier size caps."
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
    """Return the authenticated user (email, tier, quota)."""
    return client().get("auth/me")


@mcp.tool
def get_usage() -> dict:
    """Storage usage: quota_bytes, used_bytes, available_bytes, and tier."""
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
    return client().delete(f"storage/folders/{folder_id}")


@mcp.tool
def restore_folder(folder_id: str) -> dict:
    """Restore a trashed folder (and everything trashed with it)."""
    return client().post(f"storage/folders/{folder_id}/restore")


@mcp.tool
def rename_folder(folder_id: str, name: str) -> dict:
    """Rename a folder. Auto-suffixes " (n)" if the name is taken by a sibling."""
    return client().patch(f"storage/folders/{folder_id}", json={"name": name})


@mcp.tool
def move_folder(folder_id: str, parent_id: Optional[str] = None) -> dict:
    """Move a folder under parent_id (omit/None = root). Rejects moving it into
    itself or its own subtree."""
    return client().patch(f"storage/folders/{folder_id}", json={"parent": parent_id})


@mcp.tool
def purge_folder(folder_id: str) -> dict:
    """Permanently delete a trashed folder and its whole subtree. Cannot be undone."""
    return client().post(f"storage/folders/{folder_id}/purge")


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
    return client().delete(f"storage/files/{file_id}")


@mcp.tool
def restore_file(file_id: str) -> dict:
    """Restore a trashed file."""
    return client().post(f"storage/files/{file_id}/restore")


@mcp.tool
def purge_file(file_id: str) -> dict:
    """Permanently delete a trashed file (releases quota). Cannot be undone."""
    return client().post(f"storage/files/{file_id}/purge")


@mcp.tool
def rename_file(file_id: str, name: str) -> dict:
    """Rename a file. Auto-suffixes " (n)" (extension preserved) on a collision."""
    return client().patch(f"storage/files/{file_id}", json={"name": name})


@mcp.tool
def move_file(file_id: str, folder_id: Optional[str] = None) -> dict:
    """Move a file into folder_id (omit/None = root)."""
    return client().patch(f"storage/files/{file_id}", json={"folder": folder_id})


@mcp.tool
def set_file_discoverable(file_id: str, discoverable: bool, mature: bool = False) -> dict:
    """Toggle whether a file is discoverable in search, and its mature flag."""
    return client().post(
        f"storage/files/{file_id}/discoverable",
        json={"discoverable": discoverable, "mature": mature},
    )


@mcp.tool
def list_trash() -> dict:
    """List trashed folders and files."""
    return client().get("storage/trash")


@mcp.tool
def search_files(query: str) -> dict:
    """Search your files plus public discoverable (non-mature) files by name.

    Returns {"results": [...]} where each result has id, name, kind, size_bytes,
    is_own, and is_discoverable.
    """
    return client().get("storage/search", params={"q": query})


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
    File record. Raises if quota or the per-tier size cap is exceeded.
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

    return c.post(f"storage/uploads/{file_id}/complete")


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
    return c.post(f"storage/uploads/{file_id}/complete")


@mcp.tool
def get_download_url(file_id: str) -> dict:
    """Get a URL to fetch a file's bytes (presigned in R2, direct in local mode)."""
    return client().get(f"storage/files/{file_id}/download")


@mcp.tool
def download_file(file_id: str, dest_path: str) -> dict:
    """Download a file's bytes to a local path on the MCP host. Returns {path, size_bytes}."""
    c = client()
    info = c.get(f"storage/files/{file_id}/download")
    resp = c.blob_request("GET", info["download_url"])
    if resp.status_code >= 300:
        raise FloppyApiError(resp.status_code, f"blob GET failed: {resp.text[:200]}")
    dest = Path(dest_path).expanduser()
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
    return client().post(f"storage/files/{file_id}/play")


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
    a non-expiring link. Password protection is a paid-tier feature.
    """
    payload: dict[str, Any] = {}
    if password:
        payload["password"] = password
    if expires_at:
        payload["expires_at"] = expires_at
    return client().post(f"storage/files/{file_id}/share", json=payload)


@mcp.tool
def list_share_links() -> list:
    """List your active share links."""
    return client().get("storage/shares")


@mcp.tool
def revoke_share_link(share_id: str) -> dict:
    """Revoke a share link."""
    return client().delete(f"storage/shares/{share_id}")


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
    return client().post(f"notifications/{notification_id}/read")


@mcp.tool
def mark_all_notifications_read() -> dict:
    """Mark all notifications as read."""
    return client().post("notifications/read-all")


# ---------------------------------------------------------------------------
# Moderation
# ---------------------------------------------------------------------------
@mcp.tool
def report_content(
    target_id: str,
    target_type: str = "file",
    reason: str = "inappropriate",
    kind: str = "report",
    detail: str = "",
) -> dict:
    """Flag or report content.

    target_type: file. reason: copyright | inappropriate | csam | other
    (copyright requires `detail`). kind='report' reversibly isolates a file
    target pending review; kind='flag' is lightweight with no auto-action.
    """
    return client().post(
        "moderation/reports",
        json={
            "target_id": target_id,
            "target_type": target_type,
            "reason": reason,
            "kind": kind,
            "detail": detail,
        },
    )


def main() -> None:
    """Entry point: run over stdio (default) or the transport from FLOPPY_MCP_TRANSPORT."""
    transport = os.environ.get("FLOPPY_MCP_TRANSPORT", "stdio")
    mcp.run(transport=transport)


if __name__ == "__main__":
    main()

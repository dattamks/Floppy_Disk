# Floppy Disk — MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
the Floppy Disk cloud-storage platform as tools. Any MCP-aware client — **Claude
Code**, **n8n**, **Codex / OpenAI**, Claude Desktop, etc. — can then do
everything a user does: browse and manage folders and files, upload and download
media, create public share links, run channels, read notifications, and check
billing.

Built with [FastMCP](https://github.com/jlowin/fastmcp) (Python) over the
REST API documented in [`../docs/api/`](../docs/api).

## How it works

The server is a thin, authenticated wrapper over `/api/v1`. It authenticates
with a **Bearer API key** (no browser session needed) and transparently handles
both storage backends:

- **Local mode** (no Cloudflare env) — presigned URLs are relative dev URLs on
  the same origin; the server attaches the Bearer header to reach them.
- **R2 mode** — presigned URLs are absolute and self-authenticating; the server
  uses them as-is.

So the same MCP tools work whether the backend is a laptop dev instance or a
full Cloudflare-backed production deployment.

## Setup

### 1. Mint an API key (on the backend)

```bash
cd backend
python manage.py create_api_key you@example.com --name mcp
# prints:  fd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   (shown once — copy it)
```

You can also create/list/revoke keys from the API: `POST /api/v1/auth/api-keys`,
`GET /api/v1/auth/api-keys`, `DELETE /api/v1/auth/api-keys/{id}`.

### 2. Install the server

```bash
cd mcp
python -m venv .venv && source .venv/bin/activate
pip install -e .          # or: pip install -r requirements.txt
```

### 3. Configure

Copy `.env.example` to `.env` (or export the vars):

| Variable | Default | Meaning |
|---|---|---|
| `FLOPPY_API_KEY` | — (required) | Bearer API key from step 1 |
| `FLOPPY_API_BASE_URL` | `http://localhost:8000/api/v1` | API base, incl. `/api/v1` |
| `FLOPPY_MCP_TRANSPORT` | `stdio` | `stdio`, `http`, or `sse` |

### 4. Run

```bash
python -m floppy_mcp.server        # stdio (for Claude Code / Desktop)
# or
floppy-disk-mcp                    # installed console script
```

## Client configuration

### Claude Code

```bash
claude mcp add floppy-disk \
  --env FLOPPY_API_KEY=fd_xxx \
  --env FLOPPY_API_BASE_URL=https://your-host/api/v1 \
  -- python -m floppy_mcp.server
```

…or add it to your MCP config JSON:

```json
{
  "mcpServers": {
    "floppy-disk": {
      "command": "python",
      "args": ["-m", "floppy_mcp.server"],
      "env": {
        "FLOPPY_API_KEY": "fd_xxx",
        "FLOPPY_API_BASE_URL": "https://your-host/api/v1"
      }
    }
  }
}
```

### n8n

n8n's MCP Client node speaks stdio and HTTP/SSE. For a remote setup, run the
server with an HTTP transport and point the node at it:

```bash
FLOPPY_MCP_TRANSPORT=http FLOPPY_API_KEY=fd_xxx \
  FLOPPY_API_BASE_URL=https://your-host/api/v1 \
  python -m floppy_mcp.server
```

Then add an **MCP Client** node with the server URL (default FastMCP HTTP port),
and call tools like `upload_file`, `create_share_link`, `list_files`.

### Codex / OpenAI

Any client that supports MCP stdio servers uses the same command form as Claude
Code — e.g. in a `mcp_servers` config block:

```toml
[mcp_servers.floppy-disk]
command = "python"
args = ["-m", "floppy_mcp.server"]
env = { FLOPPY_API_KEY = "fd_xxx", FLOPPY_API_BASE_URL = "https://your-host/api/v1" }
```

## Tools

**Account & usage**
- `whoami` — the authenticated user (email, tier, billing_enabled)
- `get_usage` — quota, used, available bytes + tier

**Folders**
- `list_folders(parent_id?)`, `create_folder(name, parent_id?)`
- `delete_folder(folder_id)`, `restore_folder(folder_id)`
- `get_camera_backup_folder()`

**Files**
- `list_files(folder_id?)`, `delete_file`, `restore_file`, `purge_file`
- `set_file_discoverable(file_id, discoverable, mature?)`
- `list_trash()`, `search_files(query)`

**Upload / download**
- `upload_file(path, folder_id?, name?)` — full 3-step flow from a local file
- `upload_bytes(filename, content_base64, folder_id?)` — from in-memory content
- `get_download_url(file_id)`, `download_file(file_id, dest_path)`

**Video**
- `get_video_playback(file_id)`, `promote_video_to_stream(file_id)`

**Sharing**
- `create_share_link(file_id, password?, expires_at?)`
- `list_share_links()`, `revoke_share_link(share_id)`

**Channels**
- `list_channels(mine?)`, `create_channel(handle, name, description?, is_public?)`
- `subscribe_channel`, `unsubscribe_channel`
- `list_channel_posts(channel_id)`, `create_channel_post(channel_id, file_id, caption?)`

**Notifications**
- `list_notifications()`, `mark_notification_read(id)`, `mark_all_notifications_read()`

**Moderation**
- `report_content(target_id, target_type?, reason?, kind?, detail?)`

**Billing**
- `list_plans()`, `get_subscription()`, `get_referral()`

## Notes & limits

- **Quota & size caps** are enforced server-side; `upload_file` raises with a
  clear message (`quota_exceeded`, `file_too_large`) when they're hit.
- **`upload_file` / `download_file`** read/write files on the machine running the
  MCP server, not the client. For in-memory transfer use `upload_bytes`.
- Errors surface the API's `{detail, code}` so failures are actionable.
- The key inherits the owning user's tier and permissions; there is no scoping
  beyond the user yet. Treat a key like a password and revoke unused ones.

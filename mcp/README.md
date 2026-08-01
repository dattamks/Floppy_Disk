# Floppy Disk - MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
the Floppy Disk cloud-storage platform as tools. Any MCP-aware client - **Claude
Code**, **n8n**, **Codex / OpenAI**, Claude Desktop, etc. - can then do
everything a user does: browse and manage folders and files, upload and download
media, create public share links, and read notifications.

Built with [FastMCP](https://github.com/jlowin/fastmcp) (Python) over the
REST API documented in [`../docs/api/`](../docs/api).

### Protocol

Tracks the **MCP 2026-07-28** spec:

- **Stateless core** - runs with `stateless_http=True`: no `initialize`
  handshake, no `Mcp-Session-Id`, no per-session state. Each tool call is one
  self-contained REST request under your Bearer key, so the server scales
  horizontally and works on serverless hosts.
- **Streamable HTTP** for remote clients; the deprecated **HTTP+SSE** transport
  is not offered.
- **No deprecated server-initiated features** (Roots / Sampling / Logging), so
  no multi-round-trip fallbacks are needed - a tool call never opens a
  server→client stream.

Stateless request framing, `MCP-Protocol-Version` negotiation, header routing
(`Mcp-Method` / `Mcp-Name`), and cacheable list directives are handled by the
FastMCP transport layer; the tools stay transport-agnostic.

## How it works

The server is a thin, authenticated wrapper over `/api/v1`. It authenticates
with a **Bearer API key** (no browser session needed) and transparently handles
both storage backends:

- **Local mode** (no Cloudflare env) - presigned URLs are relative dev URLs on
  the same origin; the server attaches the Bearer header to reach them.
- **R2 mode** - presigned URLs are absolute and self-authenticating; the server
  uses them as-is.

So the same MCP tools work whether the backend is a laptop dev instance or a
full Cloudflare-backed production deployment.

## Setup

### 1. Mint an API key (on the backend)

```bash
cd backend
python manage.py create_api_key you@example.com --name mcp
# prints:  fd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   (shown once - copy it)
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
| `FLOPPY_API_KEY` | - (required) | Bearer API key from step 1 |
| `FLOPPY_API_BASE_URL` | `http://localhost:8000/api/v1` | API base, incl. `/api/v1` |
| `FLOPPY_MCP_TRANSPORT` | `stdio` | `stdio` (local) or `streamable-http` (remote) |
| `FLOPPY_MCP_HOST` | `127.0.0.1` | bind host for `streamable-http` |
| `FLOPPY_MCP_PORT` | `8765` | bind port for `streamable-http` |

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

For a remote setup, run the server with the Streamable HTTP transport and point
the node at it:

```bash
FLOPPY_MCP_TRANSPORT=streamable-http FLOPPY_API_KEY=fd_xxx \
  FLOPPY_API_BASE_URL=https://your-host/api/v1 \
  FLOPPY_MCP_PORT=8765 \
  python -m floppy_mcp.server
```

Then add an **MCP Client** node pointing at the server URL (host:port above) and
call tools like `upload_file`, `create_share_link`, `list_files`.

### Codex / OpenAI

Any client that supports MCP stdio servers uses the same command form as Claude
Code - e.g. in a `mcp_servers` config block:

```toml
[mcp_servers.floppy-disk]
command = "python"
args = ["-m", "floppy_mcp.server"]
env = { FLOPPY_API_KEY = "fd_xxx", FLOPPY_API_BASE_URL = "https://your-host/api/v1" }
```

## Tools

**Account & usage**
- `whoami` - the authenticated user (email, quota)
- `get_usage` - quota, used, available bytes

**Folders**
- `list_folders(parent_id?)`, `create_folder(name, parent_id?)`
- `rename_folder(folder_id, name)`, `move_folder(folder_id, parent_id?)`
- `delete_folder(folder_id)`, `restore_folder(folder_id)`, `purge_folder(folder_id)`
- `get_camera_backup_folder()`

**Files**
- `list_files(folder_id?)`, `delete_file`, `restore_file`, `purge_file`
- `rename_file(file_id, name)`, `move_file(file_id, folder_id?)`
- `set_file_discoverable(file_id, discoverable, mature?)`
- `list_trash()`, `search_files(query)` - matches names **and** document contents

**Notes / editing**
- `create_note(name, content?, folder_id?)` - a Markdown note in one call; use
  `[[wiki-links]]` to connect notes in the knowledge graph
- `edit_file_content(file_id, content)` - replace a text/Markdown document's
  contents in place (re-indexed for search; graph refreshed)

**Upload / download**
- `upload_file(path, folder_id?, name?)` - full 3-step flow from a local file
- `upload_bytes(filename, content_base64, folder_id?)` - from in-memory content
- `get_download_url(file_id)`, `download_file(file_id, dest_path)`

**Video**
- `get_video_playback(file_id)` - direct URL to play an owned video inline

**Sharing**
- `create_share_link(file_id, password?, expires_at?)`
- `list_share_links()`, `revoke_share_link(share_id)`

> The channels feature was removed in the Drive-focus pivot, and
> `promote_video_to_stream` (video streaming) was deactivated - see
> [`../docs/deactivated-features.md`](../docs/deactivated-features.md).

**Knowledge graph** (deterministic, LLM-free context for AIs)
- `get_graph()` - the whole store as GraphRAG-ready graph.json (nodes + typed,
  provenance-tagged edges, each with a plain-language reason)
- `graph_search(query)` - name matches, each with its graph neighbors
- `get_related_files(file_id)` - what relates to a file, every edge explained
- `rebuild_graph()` - force a rebuild (normally automatic)

> The graph is built globally over your files but read through the same folder
> scope as everything else: a folder-scoped key sees only its subtree's nodes,
> and cross-scope edges are clipped.

**Notifications**
- `list_notifications()`, `mark_notification_read(id)`, `mark_all_notifications_read()`

## Notes & limits

- **Quota & size caps** are enforced server-side; `upload_file` raises with a
  clear message (`quota_exceeded`, `file_too_large`) when they're hit.
- **`upload_file` / `download_file`** read/write files on the machine running the
  MCP server, not the client. For in-memory transfer use `upload_bytes`.
- Errors surface the API's `{detail, code}` so failures are actionable.
- A key inherits the owning user's data. For integrations that only
  need to read, mint a **read-only** key so it can't mutate anything:
  `python manage.py create_api_key you@example.com --name mcp-ro --read-only`
  (or `POST /auth/api-keys {"read_only": true}`). Treat a key like a password
  and revoke unused ones.
- **Folder-scoped keys.** A key can be confined to a single folder subtree:
  `POST /auth/api-keys {"root_folder": "<folder-id>"}`. Every tool then only
  sees/acts within that folder (calls outside it return not-found), and - once
  the knowledge-graph layer lands - the graph exposed to that key is likewise
  limited to its subtree. This lets you give one LLM the whole store and another
  only a specific folder.

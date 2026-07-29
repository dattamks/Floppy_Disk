"""Smoke tests for the Floppy Disk MCP server.

Guarded with importorskip because fastmcp is an optional/dev dependency — the
suite runs in CI where fastmcp is installed. Covers: the server imports and is
configured for the MCP 2026-07-28 stateless core, the pure helpers behave, and
the transport selector rejects the deprecated SSE transport.
"""
import pytest

pytest.importorskip("fastmcp")

from floppy_mcp import server  # noqa: E402


def test_server_module_loads():
    from fastmcp import FastMCP

    assert isinstance(server.mcp, FastMCP)
    assert callable(server.main)


def test_streamable_http_runs_stateless(monkeypatch):
    """2026-07-28 stateless core: the HTTP transport must run stateless_http=True.

    In fastmcp 3.x this is a runtime option (not a constructor kwarg), so assert
    main() actually forwards it to mcp.run for the streamable-http transport.
    """
    calls = {}
    monkeypatch.setattr(server.mcp, "run", lambda **kw: calls.update(kw))
    monkeypatch.setenv("FLOPPY_MCP_TRANSPORT", "streamable-http")
    server.main()
    assert calls.get("transport") == "streamable-http"
    assert calls.get("stateless_http") is True


def test_stdio_is_default(monkeypatch):
    calls = {}
    monkeypatch.setattr(server.mcp, "run", lambda **kw: calls.update(kw))
    monkeypatch.delenv("FLOPPY_MCP_TRANSPORT", raising=False)
    server.main()
    assert calls.get("transport") == "stdio"


def _registered_tool_names():
    """Best-effort tool introspection across fastmcp versions (list_tools /
    get_tools, sync or async, dict or list) — returns a set or None if the
    installed version exposes none of the known shapes."""
    import asyncio
    import inspect

    m = server.mcp
    for attr in ("get_tools", "list_tools"):
        fn = getattr(m, attr, None)
        if fn is None:
            continue
        try:
            res = fn()
            if inspect.isawaitable(res):
                res = asyncio.run(res)
        except Exception:  # noqa: BLE001 - fall through to the next shape
            continue
        if isinstance(res, dict):
            return set(res.keys())
        names = set()
        for t in res or []:
            n = getattr(t, "name", None) or (t.get("name") if isinstance(t, dict) else None)
            if n:
                names.add(n)
        if names:
            return names
    tm = getattr(m, "_tool_manager", None)
    tools = getattr(tm, "_tools", None) or getattr(tm, "tools", None)
    if isinstance(tools, dict):
        return set(tools.keys())
    return None


def test_expected_tools_registered():
    names = _registered_tool_names()
    if names is None:
        pytest.skip("cannot introspect tools on this fastmcp version")
    assert len(names) >= 20, f"expected >=20 tools, got {len(names)}"
    for expected in ("whoami", "list_files", "upload_file", "create_share_link", "search_files"):
        assert expected in names, f"missing tool: {expected}"


def test_uid_accepts_uuid_rejects_junk():
    import uuid

    good = str(uuid.uuid4())
    assert server._uid(good) == good
    for bad in ["../etc", "1 OR 1=1", "abc/def", "", None]:
        with pytest.raises(ValueError):
            server._uid(bad)


def test_guess_kind():
    assert server._guess_kind("clip.MP4") == "video"
    assert server._guess_kind("pic.jpeg") == "image"
    assert server._guess_kind("song.flac") == "audio"
    assert server._guess_kind("notes.txt") == "doc"


def test_sse_transport_is_rejected(monkeypatch):
    monkeypatch.setenv("FLOPPY_MCP_TRANSPORT", "sse")
    with pytest.raises(SystemExit):
        server.main()


def test_unknown_transport_is_rejected(monkeypatch):
    monkeypatch.setenv("FLOPPY_MCP_TRANSPORT", "carrier-pigeon")
    with pytest.raises(SystemExit):
        server.main()

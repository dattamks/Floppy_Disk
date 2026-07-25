"""HTTP client for the Floppy Disk REST API used by the MCP server.

Wraps the `/api/v1` surface with Bearer (API-key) authentication and hides two
deployment differences from the tool layer:

* **Presigned URLs.** Uploads/downloads may return either an absolute URL
  (Cloudflare R2 presigned PUT/GET — self-authenticating, must NOT carry our
  Authorization header) or a relative dev URL (`/api/v1/storage/_dev/blob/...`
  — same origin, needs the Bearer header). `blob_request()` resolves both.
* **Errors.** Non-2xx responses are raised as `FloppyApiError` carrying the
  API's `{detail, code}` body so tools return a useful message.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_BASE_URL = "http://localhost:8000/api/v1"
DEFAULT_TIMEOUT = 60.0


class FloppyApiError(RuntimeError):
    """A non-2xx response from the Floppy Disk API."""

    def __init__(self, status_code: int, detail: Any, code: str | None = None):
        self.status_code = status_code
        self.detail = detail
        self.code = code
        msg = f"HTTP {status_code}"
        if code:
            msg += f" [{code}]"
        if detail:
            msg += f": {detail}"
        super().__init__(msg)


class FloppyClient:
    """Thin, synchronous wrapper over the Floppy Disk API."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        self.base_url = (base_url or os.environ.get("FLOPPY_API_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key or os.environ.get("FLOPPY_API_KEY") or ""
        if not self.api_key:
            raise RuntimeError(
                "FLOPPY_API_KEY is not set. Create one with "
                "`python manage.py create_api_key <email>` (or via the app) and "
                "export it as FLOPPY_API_KEY."
            )
        # Origin (scheme://host[:port]) for resolving relative presigned URLs.
        self._origin = self.base_url.split("/api/", 1)[0]
        self._client = httpx.Client(
            timeout=timeout,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )

    # --- low-level -----------------------------------------------------------
    def request(self, method: str, path: str, **kwargs) -> Any:
        """Call an `/api/v1` endpoint (path relative to base_url). Returns JSON."""
        url = f"{self.base_url}/{path.lstrip('/')}"
        resp = self._client.request(method, url, **kwargs)
        return self._handle(resp)

    def get(self, path: str, **kw) -> Any:
        return self.request("GET", path, **kw)

    def post(self, path: str, **kw) -> Any:
        return self.request("POST", path, **kw)

    def patch(self, path: str, **kw) -> Any:
        return self.request("PATCH", path, **kw)

    def delete(self, path: str, **kw) -> Any:
        return self.request("DELETE", path, **kw)

    def blob_request(self, method: str, url: str, **kwargs) -> httpx.Response:
        """PUT/GET a presigned blob URL that may be absolute (R2) or relative (dev).

        Relative URLs are same-origin and need our Bearer header; absolute R2
        URLs are self-authenticating and must not receive it.
        """
        if url.startswith("/"):
            full = f"{self._origin}{url}"
            return self._client.request(method, full, **kwargs)
        # Absolute (R2 presigned): send without the Authorization header.
        with httpx.Client(timeout=self._client.timeout) as bare:
            return bare.request(method, url, **kwargs)

    # --- helpers -------------------------------------------------------------
    @staticmethod
    def _handle(resp: httpx.Response) -> Any:
        if resp.is_success:
            if resp.status_code == 204 or not resp.content:
                return {"ok": True}
            try:
                return resp.json()
            except ValueError:
                return {"ok": True, "raw": resp.text}
        detail: Any = None
        code = None
        try:
            body = resp.json()
            if isinstance(body, dict):
                detail = body.get("detail") or body
                code = body.get("code")
            else:
                detail = body
        except ValueError:
            detail = resp.text
        raise FloppyApiError(resp.status_code, detail, code)

    def close(self) -> None:
        self._client.close()

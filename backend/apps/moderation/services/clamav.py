"""
ClamAVScanService — production scanner over the clamd INSTREAM protocol.

ClamAV is open-source (GPL) and self-hosted (see the `clamav` service in
docker-compose) — no credentials, no vendor. This streams the upload bytes to
clamd on settings.CLAMAV_HOST:CLAMAV_PORT and maps the verdict to a ScanResult.
"""
from __future__ import annotations

import socket
import struct

from .base import ScanResult, ScanService

CHUNK_SIZE = 8192


class ClamAVScanService(ScanService):
    def scan(self, data: bytes) -> ScanResult:
        from django.conf import settings

        host = settings.CLAMAV_HOST
        port = settings.CLAMAV_PORT
        timeout = getattr(settings, "CLAMAV_TIMEOUT", 30)

        with socket.create_connection((host, port), timeout=timeout) as sock:
            # z-prefixed, null-terminated command.
            sock.sendall(b"zINSTREAM\0")
            payload = memoryview(data or b"")
            for start in range(0, len(payload), CHUNK_SIZE):
                chunk = payload[start:start + CHUNK_SIZE]
                sock.sendall(struct.pack("!I", len(chunk)) + bytes(chunk))
            sock.sendall(struct.pack("!I", 0))  # zero-length chunk = end of stream

            resp = bytearray()
            while True:
                buf = sock.recv(4096)
                if not buf:
                    break
                resp.extend(buf)
                if b"\x00" in buf:
                    break

        return self._parse(bytes(resp))

    @staticmethod
    def _parse(response: bytes) -> ScanResult:
        text = response.decode(errors="replace").strip().strip("\x00").strip()
        # "stream: OK"  |  "stream: Eicar-Test-Signature FOUND"
        if text.endswith("FOUND"):
            body = text.split(":", 1)[1].strip() if ":" in text else text
            signature = body[: -len("FOUND")].strip()
            return ScanResult(clean=False, signature=signature or "unknown")
        return ScanResult(clean=True)

"""ClamAVScanService — production scanner over the clamd protocol (stub)."""
from __future__ import annotations

from .base import ScanResult, ScanService


class ClamAVScanService(ScanService):
    def scan(self, data: bytes) -> ScanResult:
        # Wired in production: stream `data` to clamd (settings.CLAMAV_HOST/PORT)
        # via INSTREAM and map the verdict to ScanResult.
        raise NotImplementedError("ClamAV scanning is wired for production deployment.")

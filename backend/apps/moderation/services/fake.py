"""FakeScanService — dev/test scanner that detects the EICAR test signature."""
from __future__ import annotations

from .base import ScanResult, ScanService

# The standard anti-malware test marker (harmless; used to exercise scanners).
EICAR_MARKER = b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"


class FakeScanService(ScanService):
    def scan(self, data: bytes) -> ScanResult:
        if EICAR_MARKER in (data or b""):
            return ScanResult(clean=False, signature="EICAR-Test-Signature")
        return ScanResult(clean=True)

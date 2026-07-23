"""
ScanService abstraction (PRD 5.7).

Every upload is scanned for malware before it goes `ready`. Dev/tests use a
FakeScanService that flags the EICAR test signature; production uses ClamAV.
Selected via settings.SCAN_SERVICE.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ScanResult:
    clean: bool
    signature: str = ""  # name of the detected threat, if any


class ScanService(ABC):
    @abstractmethod
    def scan(self, data: bytes) -> ScanResult:
        """Scan raw bytes; return ScanResult(clean=False, signature=...) if a threat is found."""


def get_scan_service() -> "ScanService":
    from django.conf import settings
    from django.utils.module_loading import import_string

    return import_string(settings.SCAN_SERVICE)()

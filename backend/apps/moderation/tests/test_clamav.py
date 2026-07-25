"""Unit test for the ClamAV clamd INSTREAM client (mocked socket — no live clamd)."""
import struct

import pytest

from apps.moderation.services.clamav import ClamAVScanService


class FakeSocket:
    def __init__(self, response: bytes):
        self._response = response
        self.sent = bytearray()
        self._read = False

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def sendall(self, b):
        self.sent.extend(b)

    def recv(self, n):
        if self._read:
            return b""
        self._read = True
        return self._response


@pytest.fixture
def patch_socket(monkeypatch):
    holder = {}

    def _install(response):
        sock = FakeSocket(response)
        holder["sock"] = sock
        monkeypatch.setattr(
            "apps.moderation.services.clamav.socket.create_connection",
            lambda *a, **k: sock,
        )
        return sock

    return _install


def test_clean_stream_reports_clean(patch_socket, settings):
    settings.CLAMAV_HOST, settings.CLAMAV_PORT = "localhost", 3310
    sock = patch_socket(b"stream: OK\x00")
    result = ClamAVScanService().scan(b"hello world")
    assert result.clean is True
    # protocol: INSTREAM command + a chunk + zero-length terminator
    assert sock.sent.startswith(b"zINSTREAM\x00")
    assert sock.sent.endswith(struct.pack("!I", 0))


def test_found_stream_reports_signature(patch_socket, settings):
    settings.CLAMAV_HOST, settings.CLAMAV_PORT = "localhost", 3310
    patch_socket(b"stream: Eicar-Test-Signature FOUND\x00")
    result = ClamAVScanService().scan(b"nasty bytes")
    assert result.clean is False
    assert result.signature == "Eicar-Test-Signature"


def test_empty_data_still_sends_terminator(patch_socket, settings):
    settings.CLAMAV_HOST, settings.CLAMAV_PORT = "localhost", 3310
    sock = patch_socket(b"stream: OK\x00")
    ClamAVScanService().scan(b"")
    assert sock.sent == b"zINSTREAM\x00" + struct.pack("!I", 0)

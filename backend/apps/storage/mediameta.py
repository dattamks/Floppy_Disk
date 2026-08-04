"""Read image pixel dimensions from a file's header bytes - no Pillow needed.

Supports the common web image formats (PNG, JPEG, GIF, BMP, WebP). Returns
(width, height) or None if the bytes aren't a recognised/parseable image. Only
the header is needed, so callers pass a small bounded prefix of the blob.
"""
from __future__ import annotations

import struct


def image_dimensions(data: bytes):
    if not data or len(data) < 24:
        return None
    # PNG: 8-byte signature, then IHDR with width/height as big-endian uint32.
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        try:
            w, h = struct.unpack(">II", data[16:24])
            return (w, h) if w and h else None
        except struct.error:
            return None
    # GIF: logical screen width/height are little-endian uint16 at offset 6.
    if data[:6] in (b"GIF87a", b"GIF89a"):
        w, h = struct.unpack("<HH", data[6:10])
        return (w, h) if w and h else None
    # BMP: BITMAPINFOHEADER width/height (signed int32, little-endian).
    if data[:2] == b"BM" and len(data) >= 26:
        w, h = struct.unpack("<ii", data[18:26])
        return (abs(w), abs(h)) if w and h else None
    # WebP: RIFF container -> VP8 (lossy), VP8L (lossless), or VP8X (extended).
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return _webp(data)
    # JPEG: walk the marker segments to the Start-Of-Frame.
    if data[:2] == b"\xff\xd8":
        return _jpeg(data)
    return None


def _webp(data: bytes):
    fmt = data[12:16]
    try:
        if fmt == b"VP8 " and len(data) >= 30:
            w = struct.unpack("<H", data[26:28])[0] & 0x3FFF
            h = struct.unpack("<H", data[28:30])[0] & 0x3FFF
            return (w, h) if w and h else None
        if fmt == b"VP8L" and len(data) >= 25:
            b = data[21:25]
            bits = b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)
            w = (bits & 0x3FFF) + 1
            h = ((bits >> 14) & 0x3FFF) + 1
            return (w, h)
        if fmt == b"VP8X" and len(data) >= 30:
            w = 1 + (data[24] | (data[25] << 8) | (data[26] << 16))
            h = 1 + (data[27] | (data[28] << 8) | (data[29] << 16))
            return (w, h)
    except (struct.error, IndexError):
        return None
    return None


# JPEG Start-Of-Frame markers carry the real dimensions; skip standalone and
# non-SOF segments by their length field.
_SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def _jpeg(data: bytes):
    i, n = 2, len(data)
    while i + 9 < n:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in _SOF:
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return (w, h) if w and h else None
        i += 2 + seg_len
    return None

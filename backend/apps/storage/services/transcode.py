"""
Self-hosted video transcoding - no third-party streaming service.

Users upload videos in any format; browsers only natively play a narrow set
(H.264/AAC in MP4, plus WebM/Ogg). To let a user watch back *their own* upload
regardless of source format, we transcode a normalized, progressively-seekable
MP4 rendition **on our own servers** with FFmpeg (the open-source multimedia
framework), then serve it over the existing HTTP Range endpoint. No Cloudflare
Stream, no external accounts, no per-minute fees.

- `MediaTranscoder` is the abstraction; `settings.MEDIA_TRANSCODER` selects an
  implementation (mirrors STORAGE_SERVICE).
- `FFmpegTranscoder` shells out to the bundled `ffmpeg` / `ffprobe` binaries.
- `FakeTranscoder` needs no binaries - used in dev/tests so the suite stays
  fast and hermetic.
"""
from __future__ import annotations

import json
import shutil
import subprocess  # noqa: S404 - transcoding requires the ffmpeg binary
import tempfile
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

# Containers/codecs a browser can play natively from a progressive MP4 - if the
# upload already matches, we skip transcoding and serve the original bytes.
_WEB_CONTAINERS = {"mp4", "mov", "m4v"}
_WEB_VIDEO_CODECS = {"h264", "avc1"}
_WEB_AUDIO_CODECS = {"aac", "mp4a", ""}  # "" = video-only file (no audio track)


@dataclass
class VideoMeta:
    duration_seconds: float | None = None
    width: int | None = None
    height: int | None = None
    video_codec: str = ""
    audio_codec: str = ""
    container: str = ""
    is_web_playable: bool = False


class MediaTranscoder(ABC):
    """Operates on a source *file path*, never the whole video held in memory.

    A video can be gigabytes; buffering it (and its rendition) in RAM would OOM
    a small self-host box. FFmpeg reads and writes files, so callers hand us the
    on-disk source path and we shell out against it directly. Only the derived
    outputs (a poster JPEG, or a transcoded MP4) come back as bytes.
    """

    @abstractmethod
    def probe(self, *, src: Path, filename: str = "") -> VideoMeta:
        """Inspect the video file and report format/metadata."""

    @abstractmethod
    def transcode_to_mp4(self, *, src: Path) -> bytes:
        """Return browser-playable H.264/AAC MP4 bytes (faststart for seeking)."""

    @abstractmethod
    def poster(self, *, src: Path) -> bytes:
        """Return a JPEG poster frame grabbed from early in the video."""


class FakeTranscoder(MediaTranscoder):
    """No-binary stand-in for dev/tests.

    Treats `.mp4` uploads as already web-playable and everything else as needing
    a (pretend) transcode, so both code paths are exercised without FFmpeg.
    """

    def probe(self, *, src: Path, filename: str = "") -> VideoMeta:
        container = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
        web = container in _WEB_CONTAINERS
        return VideoMeta(
            duration_seconds=10.0,
            width=1280,
            height=720,
            video_codec="h264" if web else "hevc",
            audio_codec="aac",
            container=container,
            is_web_playable=web,
        )

    def transcode_to_mp4(self, *, src: Path) -> bytes:
        # Pretend-normalized bytes; a marker keeps it distinct from the original.
        return b"FAKEMP4\x00" + src.read_bytes()

    def poster(self, *, src: Path) -> bytes:
        # Minimal but valid-ish JPEG header so downstream sniffers see an image.
        return b"\xff\xd8\xff\xe0FAKEJPEG"


class FFmpegTranscoder(MediaTranscoder):
    """Real transcoder over the bundled ffmpeg/ffprobe binaries."""

    def probe(self, *, src: Path, filename: str = "") -> VideoMeta:
        out = _run(
            [
                _ffprobe(), "-v", "quiet", "-print_format", "json",
                "-show_format", "-show_streams", str(src),
            ]
        )
        try:
            info = json.loads(out or b"{}")
        except ValueError:
            return VideoMeta()
        vstream = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
        astream = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), {})
        fmt = info.get("format", {})
        container = (fmt.get("format_name") or "").split(",")[0].lower()
        vcodec = (vstream.get("codec_name") or "").lower()
        acodec = (astream.get("codec_name") or "").lower()
        try:
            duration = float(fmt.get("duration")) if fmt.get("duration") else None
        except (TypeError, ValueError):
            duration = None
        return VideoMeta(
            duration_seconds=duration,
            width=vstream.get("width"),
            height=vstream.get("height"),
            video_codec=vcodec,
            audio_codec=acodec,
            container=container,
            is_web_playable=(
                container in _WEB_CONTAINERS
                and vcodec in _WEB_VIDEO_CODECS
                and acodec in _WEB_AUDIO_CODECS
            ),
        )

    def transcode_to_mp4(self, *, src: Path) -> bytes:
        with tempfile.TemporaryDirectory() as d:
            dst = Path(d) / "out.mp4"
            _run(
                [
                    _ffmpeg(), "-y", "-i", str(src),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart",  # move the moov atom up front for seeking
                    str(dst),
                ]
            )
            return dst.read_bytes()

    def poster(self, *, src: Path) -> bytes:
        with tempfile.TemporaryDirectory() as d:
            dst = Path(d) / "poster.jpg"
            _run(
                [
                    _ffmpeg(), "-y", "-ss", "1", "-i", str(src),
                    "-frames:v", "1", "-vf", "scale=640:-2", str(dst),
                ]
            )
            return dst.read_bytes()


# --- binary resolution + subprocess helpers ---------------------------------
def _static_bundle() -> tuple[str, str] | None:
    """Optional pip-bundled static binaries (ships ffmpeg+ffprobe in the wheel)."""
    try:
        import static_ffmpeg.run as _sf

        return _sf.get_or_fetch_platform_executables_else_raise()  # (ffmpeg, ffprobe)
    except Exception:  # noqa: BLE001 - not installed / fetch failed
        return None


def _binary(setting_name: str, default: str, bundle_index: int) -> str:
    """Resolve a binary path: settings override -> PATH -> static_ffmpeg bundle."""
    from django.conf import settings

    configured = getattr(settings, setting_name, "") or ""
    if configured:
        return configured
    found = shutil.which(default)
    if found:
        return found
    bundle = _static_bundle()
    if bundle:
        return bundle[bundle_index]
    return default  # bare name; let subprocess raise a clear error


def _ffmpeg() -> str:
    return _binary("FFMPEG_BINARY", "ffmpeg", 0)


def _ffprobe() -> str:
    return _binary("FFPROBE_BINARY", "ffprobe", 1)


def _run(cmd: list[str]) -> bytes:
    proc = subprocess.run(  # noqa: S603 - args are constructed, not shell-interpolated
        cmd, capture_output=True, check=False, timeout=600
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"{cmd[0]} failed ({proc.returncode}): {proc.stderr.decode('utf-8', 'replace')[:500]}"
        )
    return proc.stdout


def get_media_transcoder() -> MediaTranscoder:
    from django.conf import settings
    from django.utils.module_loading import import_string

    return import_string(settings.MEDIA_TRANSCODER)()

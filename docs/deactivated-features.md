# Deactivated & removed features — Drive-focus pivot

**Date:** 2026-07-26
**Why:** Refocus the product as a **Google-Drive-style cloud storage app**
(files, folders, upload, preview, share, trash, quotas). The "media platform"
features — **Channels** (broadcast/social) and the **third-party video
streaming platform** (Cloudflare Stream / adaptive HLS, HD-SD tiering, pre-roll
ads) — were dropped. Users still upload and watch back **their own** videos;
that playback is now **self-hosted** (see below), with no external streaming
service.

## Channels — deleted

The channels feature (broadcast channels, posts, subscriptions, composer,
discover/trending, channel-post comments, channel reporting) was **removed
entirely** from the codebase — not a reversible deactivation.

- **Backend:** deleted the `apps/channels` app. Dropped channel-specific enum
  values from kept models, with migrations:
  - `moderation.ContentReport.TargetType` — dropped `channel`/`post` (file only)
  - `notifications.Notification.Type` — dropped `channel_created`/`channel_post`
- **Frontend:** deleted the 12 channel components; stripped all channel state,
  handlers, and view-model fields from `App.jsx`; removed the Channels nav and
  the channel API-client methods.
- **MCP:** removed the channel tools.
- **API spec:** removed the `Channel`/`ChannelPost` schemas, `ChannelId` param,
  `Channels` tag, and channel enum values.

## Third-party video streaming (Cloudflare Stream) — removed & replaced

The Cloudflare Stream integration (promote-to-Stream, adaptive HLS, HD/SD
tiering, the Stream webhook) was **deleted** and **replaced with a self-hosted
transcoding pipeline** — the product no longer depends on any third-party video
service.

- **Removed:** `apps/storage/services/video.py` (the `VideoService` /
  `CloudflareStreamService` abstraction), the `promote` + `stream/webhook`
  routes and views, the `File.stream_uid` field, and the
  `CLOUDFLARE_STREAM_*` / `VIDEO_SERVICE` settings.
- **Replaced with (self-hosted):** on upload, a background Celery task probes
  the video and, if it isn't already browser-playable, transcodes it to an
  H.264/AAC MP4 with **FFmpeg** (open-source, bundled in the image) and grabs a
  poster frame. The rendition is served over the existing HTTP **Range**
  endpoint — progressive download + native seeking, no CDN or streaming SaaS.
  See `apps/storage/services/transcode.py`, `apps/storage/video_processing.py`,
  and `apps/storage/video_views.py`.
  - `MEDIA_TRANSCODER` selects the implementation: `FFmpegTranscoder` (real,
    used when an ffmpeg binary is present) or `FakeTranscoder` (no-binary, for
    dev/CI). The Docker image installs `ffmpeg`; `static-ffmpeg` is a pip
    fallback for bare-host installs.

### Still deactivated: the "Continue watching" carousel
The watched-progress *"Continue watching"* carousel was part of the streaming
platform's viewing experience, not basic own-file playback. Its component lives
at `frontend/src/deactivated/ContinueWatchingCard.jsx` and is unwired. To
re-enable, move it back into `src/components/`, restore its usage in
`AppShell`, and feed it watched-progress data.

## What was NOT touched
Everything Drive-core: auth, storage (folders/files/upload/quota/dedup), trash,
sharing (incl. public download), search, billing, notifications, moderation
(file reports), analytics, device backup, and the legal surface.

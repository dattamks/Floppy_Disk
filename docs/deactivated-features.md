# Deactivated & removed features — Drive-focus pivot

**Date:** 2026-07-26
**Why:** Refocus the product as a **Google-Drive-style cloud storage app**
(files, folders, upload, preview, share, trash, quotas). The "media platform"
features — **Channels** (broadcast/social) and the **video streaming platform**
(Cloudflare Stream / HLS, HD-SD tiering, pre-roll ads, "Continue watching") —
were dropped from the product. **Channels were deleted outright**; the video
streaming platform was **deactivated** (moved aside, reversible). Basic inline
playback of your *own* uploaded videos was kept (Drive lets you preview a video
you uploaded).

## Channels — deleted

The channels feature (broadcast channels, posts, subscriptions, composer,
discover/trending, channel-post comments, channel reporting) was **removed
entirely** from the codebase. This is not a reversible deactivation — restoring
it means recovering the code from version control.

- **Backend:** the `apps/channels` app was deleted (models, views, serializers,
  urls, tests). It was already out of `INSTALLED_APPS` and had no URL mount.
  Channel-specific enum values were removed from kept models and superseded by
  migrations:
  - `moderation.ContentReport.TargetType` — dropped `channel` / `post`
    (only `file` remains); see `moderation/migrations/0002_*`.
  - `notifications.Notification.Type` — dropped `channel_created` /
    `channel_post`; see `notifications/migrations/0002_*`.
- **Frontend:** the 12 channel components were deleted (`ChannelsScreen`,
  `ChannelRow`, `ChannelGridCard`, `ChannelDetailPost`, `PostCard`,
  `TrendingCard`, `SubscribedChip`, `CategoryChip`, `ComposerModal`,
  `NewChannelModal`, `ChannelSettingsModal`, `ReportModal`). All channel state,
  handlers, and view-model fields were removed from `App.jsx`; the Channels nav
  is gone from the sidebar, mobile tab bar, and drawer; `loadChannels()` and the
  channel API-client methods were deleted.
- **MCP:** the channel tools (`list_channels`, `create_channel`,
  `subscribe_channel`, `unsubscribe_channel`, `list_channel_posts`,
  `create_channel_post`) were removed.
- **API spec:** the `Channel` / `ChannelPost` schemas, the `ChannelId`
  parameter, the `Channels` tag, and the channel notification/report enum values
  were removed from `docs/api/openapi.yaml`.
- **Tests:** the channel E2E and backend channel tests were removed; the core
  notification tests use the generic `notify()` dispatch.

## Video streaming platform — deactivated (basic playback kept)

- **Kept:** `VideoPlayView` (`POST /storage/files/{id}/play`) — returns a simple
  `{mode: "direct", url}` for inline playback. Local Range-serving of media is
  unchanged.
- **Deactivated:** `VideoPromoteView` + `StreamWebhookView` →
  `backend/deactivated/video_streaming.py`; the `promote` and `stream/webhook`
  routes are commented out in `apps/storage/urls.py`. HD/SD `max_resolution`
  tiering and the HLS branch were removed from `VideoPlayView`.
- **Frontend `VideoModal`:** removed the SD/HD tier selector, the HD-upgrade
  hint, and the pre-roll ad slot (kept play/seek/volume/speed/CC/fullscreen).
  `ContinueWatchingCard` was moved to `frontend/src/deactivated/`.
- **MCP:** `promote_video_to_stream` removed (`get_video_playback` kept).
- **Tests:** streaming tests → `backend/deactivated/tests_video_streaming.py`;
  `apps/storage/tests/test_video.py` keeps the basic-playback tests.

## What was NOT touched
Everything Drive-core: auth, storage (folders/files/upload/quota/dedup), trash,
sharing (incl. public download), search, billing, notifications, moderation
(file reports), analytics, device backup, the legal surface, and **basic inline
video playback of your own files**.

## How to re-enable video streaming
1. Restore the `promote` + `stream/webhook` routes in `apps/storage/urls.py`
   pointing at `deactivated/video_streaming.py` (or move it back), and re-add the
   HD/SD + HLS branch to `VideoPlayView`.
2. Move `src/deactivated/ContinueWatchingCard.jsx` back to `src/components/`,
   restore its usage in `AppShell`, and re-add the `VideoModal` streaming
   controls.
3. Restore `promote_video_to_stream` in `mcp/floppy_mcp/server.py`.
4. Move the streaming specs out of `deactivated/`; drop the pytest/Playwright
   ignore entries.

Grep for `DEACTIVATED` across the repo to find every switch-off point for the
streaming platform.

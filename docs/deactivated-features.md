# Deactivated features — Drive-focus pivot

**Date:** 2026-07-26
**Why:** Refocus the product as a **Google-Drive-style cloud storage app**
(files, folders, upload, preview, share, trash, quotas). The "media platform"
features — **Channels** (broadcast/social) and the **video streaming platform**
(Cloudflare Stream / HLS, HD-SD tiering, pre-roll ads, "Continue watching") —
were moved out and unwired. **Nothing was deleted** — this is reversible
deactivation. Basic inline playback of your *own* uploaded videos was kept
(Drive lets you preview a video you uploaded).

## What was deactivated

### Channels (removed entirely)
- **Backend:** `apps/channels` → `backend/deactivated/channels/` (models, views,
  serializers, urls, tests). Commented out of `INSTALLED_APPS` and the
  `/api/v1/channels/` URL mount.
- **Frontend:** 13 components → `frontend/src/deactivated/` — `ChannelsScreen`,
  `PostCard`, `TrendingCard`, `ChannelRow`, `ChannelGridCard`,
  `ChannelDetailPost`, `SubscribedChip`, `CategoryChip`, `ComposerModal`,
  `NewChannelModal`, `ChannelSettingsModal`, `ReportModal`,
  `ContinueWatchingCard`. Channels nav removed from the sidebar, mobile tab bar,
  and drawer; `loadChannels()` disabled.
- **MCP:** `list_channels`, `create_channel`, `subscribe_channel`,
  `unsubscribe_channel`, `list_channel_posts`, `create_channel_post` removed.
- **Tests:** `e2e/channels.spec.js` + `e2e/notifications.spec.js` (channel-
  triggered) → `frontend/e2e/deactivated/` (Playwright `testIgnore`). Backend
  channel tests moved with the app. Notification core tests now use the generic
  `notify()` dispatch instead of channel events.

### Video streaming platform (removed; basic playback kept)
- **Kept:** `VideoPlayView` (`POST /storage/files/{id}/play`) — now returns a
  simple `{mode: "direct", url}` for inline playback. Local Range-serving of
  media is unchanged.
- **Deactivated:** `VideoPromoteView` + `StreamWebhookView` →
  `backend/deactivated/video_streaming.py`; the `promote` and `stream/webhook`
  routes are commented out in `apps/storage/urls.py`. HD/SD `max_resolution`
  tiering and the HLS branch were removed from `VideoPlayView`.
- **Frontend `VideoModal`:** removed the SD/HD tier selector, the HD-upgrade
  hint, and the pre-roll ad slot (kept play/seek/volume/speed/CC/fullscreen).
- **MCP:** `promote_video_to_stream` removed (`get_video_playback` kept).
- **Tests:** streaming tests → `backend/deactivated/tests_video_streaming.py`;
  `apps/storage/tests/test_video.py` keeps the basic-playback tests.

### Docs
- `docs/api/openapi.yaml` + `docs/api/README.md`: channels paths and the video
  promote/stream paths removed; `play` simplified. The `Channel`/`ChannelPost`
  schemas remain defined (unused) to ease re-enabling.

## What was NOT touched
Everything Drive-core: auth, storage (folders/files/upload/quota/dedup), trash,
sharing (incl. public download), search, billing, notifications, moderation
(file reports), analytics, device backup, the legal surface, and **basic inline
video playback of your own files**.

## How to re-enable
1. **Backend channels:** move `backend/deactivated/channels` back to
   `backend/apps/channels`, uncomment `"apps.channels"` in `INSTALLED_APPS` and
   the URL mount in `config/urls.py`, move its tests back.
2. **Video streaming:** restore the `promote` + `stream/webhook` routes in
   `apps/storage/urls.py` pointing at `deactivated/video_streaming.py` (or move
   it back), and re-add the HD/SD + HLS branch to `VideoPlayView`.
3. **Frontend:** move `src/deactivated/*` back to `src/components/`, restore the
   imports/usages in `AppView`/`AppShell`, the Channels nav in `Sidebar` +
   `MobileTabBar` + drawer, `loadChannels()`, and the `VideoModal` controls.
4. **MCP:** restore the channel tools + `promote_video_to_stream` in
   `mcp/floppy_mcp/server.py`.
5. **Tests:** move the specs out of `deactivated/`; drop the pytest/Playwright
   ignore entries.

Grep for `DEACTIVATED` across the repo to find every switch-off point.

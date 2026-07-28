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

### Also removed: the "Continue watching" carousel
The watched-progress *"Continue watching"* carousel was part of the streaming
platform's viewing experience, not basic own-file playback — its (unwired)
component was deleted along with the rest of the streaming feature.

## Billing, subscriptions & referrals — removed

The paid-tier billing surface was **removed entirely** — the product is now a
single-tier storage app with no subscriptions, payments, or referrals.

- **Backend:** deleted the `apps/billing` app (plans, subscribe/cancel, the
  Razorpay/`PaymentGateway` gateways + webhook, `Subscription`/`WebhookEvent`/
  `ReferralBonus` models, the referral program, and the expiry-anchored
  subscription **freeze lifecycle**). Removed the billing URL mount and the
  freeze Celery-beat task.
- **Quota:** an account's limit is now its plain `quota_bytes` (the old
  `effective_quota` referral-bonus stacking is gone). New signups receive the
  standard allowance directly (`DEFAULT_QUOTA_BYTES`, 2 TB) instead of via
  billing entitlements — no account is downgraded. Dropped the
  `RAZORPAY_ENABLED` / `PAYMENT_GATEWAY` / `DEFAULT_SIGNUP_PLAN` settings and
  the `billing_enabled` user field.
- **Frontend:** removed the billing API-client methods, the "Upgrade storage"
  CTA, and `upgradeStorage` / `billingEnabled` state.
- **MCP:** removed the billing tools (`list_plans`, `get_subscription`,
  `get_referral`).
- **Schema:** dropped the now-meaningless billing columns entirely —
  `User.tier` (single storage tier), `User.referral_code` / `referred_by`, and
  `File.is_frozen`. The free/paid distinctions they gated collapsed to single
  values: one **20 GB per-file cap** and one **30-day** trash retention, and
  password-protected share links are available to everyone.

## Content moderation & malware scanning — removed

Trust-and-safety machinery for a commercial platform, unneeded for a
self-hosted open-source Drive.

- **Backend:** deleted the `apps/moderation` app (the `ContentReport`
  Flag/Report model incl. the CSAM reason, and the ClamAV/fake malware-scan
  services). Removed the upload-time scan/quarantine step, so uploads go
  straight to ready (videos to processing → ready).
- **Schema:** dropped `File.is_quarantined` and the quarantine-based legal hold
  on account hard-delete; simplified `StorageObject.Status` (dropped
  `scanning`/`quarantined`) and `File.Status` (dropped `scanning`/`failed`) to
  the states actually used.
- **Config:** removed the `SCAN_SERVICE` / `SCAN_FAILURE_MODE` / `CLAMAV_*`
  settings, the `report` throttle scope, and the ClamAV docker-compose service.
- **Frontend/MCP:** removed the (unused) `api.report` method and the MCP
  `report_content` tool.

## India IT-Rules grievance surface — removed

The grievance/redressal endpoints (`apps/common/legal_views.py` — policy-version
+ grievance-officer info and grievance filing), the `Grievance` model, the
`/api/v1/legal/` routes, the `grievance` throttle, and the
`GRIEVANCE_OFFICER_*` / `TOS_VERSION` / `PRIVACY_VERSION` settings were removed —
commercial-India-specific machinery unneeded for a self-hosted open-source Drive.
The DPDPA-style account delete / export / consent endpoints (in `apps/accounts`)
are kept. The `apps/common` app remains for its shared base models and the health
check.

The original `docs/PRD-02-Backend-Platform.md` product spec (which described the
removed billing, channels, moderation, and monetization features) was also
removed; the current API is documented under `docs/api/`.

## What was NOT touched
Everything else Drive-core: auth, storage (folders/files/upload/quota/dedup),
trash, sharing (incl. public download), search, notifications, analytics,
device backup, and the DPDPA account delete/export/consent endpoints.

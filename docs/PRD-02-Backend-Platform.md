# PRD: Backend & Platform — Cloud Storage / Sharing / Streaming Application

**Status:** Draft for POC build (revised post gap-review)
**Owner:** Datta / Datakraft
**Stack:** Django + DRF, PostgreSQL, Celery + Redis
**POC Infra:** Railway (Django + Postgres + Redis + React/Vite frontend), Cloudflare (R2 + Stream + CDN), AWS via `boto3` (Cognito) — see Section 10 for the infra/migration plan.

> **Revision note:** This version consolidates the resolutions from the PRD-02 gap review. Design decisions that were previously abstract or contradictory have been replaced with the resolved architecture (reserve-then-commit quota, video-to-R2-first scanning, universal CSAM scanning with containment decoupled from account punishment, expiry-anchored subscription freeze lifecycle, per-region deduplication, and the full rate-limiting spec). Items still genuinely undecided are consolidated in Section 6 (Open Questions & Decisions).

---

## 1. Problem Statement

Users need a general-purpose cloud storage product — upload, organize, share, and stream files and video — priced and positioned to compete with Google Drive/Dropbox (trust, ease) and TeraBox (storage generosity) for the Indian market first, with region-selectable storage for future global expansion. The product must be ad-supported on a generous free tier and profitable on paid tiers, which requires careful unit-economics management (see Section 9) since storage/streaming costs scale with usage, not just user count. Target scale is mass consumer (lakhs+ of users), India-first.

## 2. Goals

- Ship a POC on low-cost infrastructure (Railway) that proves the core product loop (upload → organize → share → stream) before committing to full AWS infrastructure spend.
- Keep all AWS-dependent code paths (auth) written against `boto3`/AWS SDKs from day one, so migrating the *hosting* from Railway to AWS ECS Fargate later requires no rewrite — only infrastructure and environment-variable changes.
- Validate real user storage/streaming behavior against the unit-economics model (Section 9) before finalizing subscription pricing.
- Support both web and (future) mobile/desktop clients from a single versioned API.
- Enforce a trust-and-safety posture (universal malware + CSAM scanning, reversible containment) that is a genuine differentiator versus incumbents, not just parity.

## 3. Non-Goals (v1 / POC)

- **Native mobile app** — platform/framework choice deferred; backend is API-first and platform-agnostic, but no mobile client ships in this phase.
- **Desktop sync client** — captured as backlog, not designed or built in this phase.
- **Creator monetization program** (pay-per-view/download for uploaders) — deferred until moderation/reporting pipeline has real-world track record post-MVP (see Section 5.4).
- **Multi-environment setup** (dev/staging/prod separation) — POC runs in a single environment. Environment separation is an MVP-phase concern.
- **Localization** — English only for POC; regional language support planned for MVP.
- **Grafana / unified observability dashboard** — Phase 1 uses Sentry + CloudWatch directly; Grafana is a Phase 2 addition.
- **A-la-carte storage top-ups** — rejected; pricing is tier-based only.
- **Global (non-India) launch** — global pricing, non-India storage regions, and a non-India payment gateway (e.g. Stripe) are treated as one interdependent bundle, deferred together until ready to launch outside India (see Section 5.3, Payment/Region).
- **Cold-storage / Infrequent-Access holding tier** for lapsed users — explicitly simplified away (see Section 5.3, Subscription Lifecycle).

## 4. User Stories (selected, by capability area)

**Auth & Account**
- As a new user, I want to sign up with my phone number and OTP so I can start using the app quickly without a password.
- As a user, I want to link a recovery email so I can regain access if I lose my phone number.
- As a user, I want to sign in with Google/Apple so I don't need to create new credentials.

**Storage & Files**
- As a user, I want to upload files/folders and organize them in nested folders, so my storage stays organized like Google Drive.
- As a user, I want large file uploads to resume if my connection drops, so I don't lose progress on big files.
- As a user, when I copy a file someone shared with me into my own storage, I want it to persist independently, so it's unaffected if the original owner deletes their account.

**Sharing & Discovery**
- As a user, I want to share a file/folder privately with specific people, or generate a public link, so I can control who sees my content.
- As a paid user, I want to password-protect a share link, so I can add an extra layer of control.
- As a user, I want to mark content as discoverable so others can find it via search/browse.

**Channels**
- As a user, I want to create a channel and post files/folders to it, so I can broadcast content to many subscribers at once.
- As a channel owner, I want to promote a trusted subscriber to admin, so they can also post.

**Video**
- As a user, I want to stream video with adaptive quality based on my connection, so playback doesn't stutter.
- As a free-tier user, I understand my streaming resolution is capped (vs. paid HD), so there's a clear incentive to upgrade.

**Billing & Quota**
- As a free-tier user, I want to see my storage usage against my 500GB quota, and be blocked from new uploads if I exceed it, so I understand my limits clearly.
- As a user, I want to refer friends and earn bonus storage, so I'm incentivized to grow the platform.
- As a paid user, I want my subscription to renew automatically and receive a GST-compliant invoice, so billing is transparent and compliant.
- As a user whose subscription lapses, I want clear warnings and a way to download or delete my own content before anything is removed.

**Trust & Safety**
- As a platform operator, I want every upload scanned for malware and CSAM, so the platform stays safe regardless of content visibility.
- As a user, I want to report content or a channel that violates policy, so bad actors can be addressed.

## 5. Requirements

### 5.1 Auth, Identity & Account Security (P0)

- [ ] **AWS Cognito integration (via `boto3`)** supporting email/password, phone+OTP, Google/Apple social login.
- [ ] **Minimum account age: 18.** Raised from an earlier 13 specifically to avoid DPDPA's verifiable-parental-consent requirement for minors rather than build a parental-consent flow. DOB is collected at signup but is **not load-bearing for content safety** (mature content policy no longer depends on age-gating — see 5.5).
- [ ] **Recovery email** (verified via link) for account recovery.
- [ ] **Phone re-verification every 90 days**, rolling from the last-verified date — mitigates phone-number recycling (reassigned Indian telecom numbers could otherwise let a new holder OTP into the previous owner's account).
- [ ] **Email re-verification** triggered only when the user actively changes their email (OTP-based change flow), not on a recurring schedule.
- [ ] **Dormant accounts:** no login for 6 months moves an account to a distinct "dormant" status; exiting dormant requires a separate restore process beyond logging in (exact mechanics open — see Section 6).
- [ ] **`UserDevice` tracking** (device_id, type, last_seen, push_token) for security/session visibility and fraud signals — explicitly **not** used for rate-limiting (rate limiting is per-account/per-IP, see 5.2).
- [ ] **`X-Client-Platform` header** (`ios`/`android`/`web`) read on every request for client-type awareness (no longer used to gate mature content — see 5.5).

### 5.2 Rate Limiting (P0)

IP address is logged on every attempt. Security-relevant actions notify the account owner via email + SMS when a hard limit is hit; scraping/browsing/reporting limits are internal-only.

| Action | Soft limit | Hard limit → consequence | Notification |
|---|---|---|---|
| OTP request | 3 / 10 min | 10/day → 4hr lockout | Email + SMS alert |
| Login attempt | 5 / 15 min | 10/day → 4hr lockout | Email + SMS alert |
| Share-link password attempt | — | 10 attempts → 24hr lockout | Notify link owner |
| Discoverable content browsing/search | ~100 req/min | Throttle | Internal log only |
| Public share-link sequential guessing | ~20/min per IP | Flag/throttle | Internal only |
| Report/flag submission | ~10/hour/account | Sustained spam flags account for review | Internal only |
| Upload rate | Tiered by account (free stricter, paid relaxed) | — | — |

### 5.3 Storage, Quota & Billing (P0)

**Storage core & deduplication**
- [ ] `StorageObject` (content-hash-addressed dedup layer) + `File` + `Folder` models (nested folders).
- [ ] **Deduplication is scoped per-region, not globally.** Region-pinned R2 buckets (for data residency) cannot dedupe across regions by definition; treating dedup as global would silently undermine the residency promise.
  - **Same-region copy** ("add to my storage" from a discoverable file): new `File` row references the existing `StorageObject`, `ref_count += 1`, no bytes moved.
  - **Cross-region copy:** a Celery task fetches bytes from the source region's bucket and writes them into the destination region's bucket, creating a **new** `StorageObject` there (deduped within that region only). Acknowledged tradeoff: cross-region-popular content is more expensive than the original unit-economics model assumed — a live risk to monitor (Section 9).
- [ ] **Presigned direct-to-R2 upload flow;** multipart/resumable for large files.
- [ ] Copy-on-share creates an independent `File` row; content persists even if the original owner deletes it or their account.
- [ ] Upload-conflict handling: **replace** or **add-as-copy** (auto-suffixed name); no version history.
- [ ] Trash/soft-delete: `deleted_at`, retention 7 days (free) / 30 days (paid), daily Celery purge job (decrements `StorageObject.ref_count`, hard-deletes at 0). Trash counts toward quota until purged.

**Quota enforcement — reserve-then-commit (resolves the TOCTOU race)**
- [ ] `storage_used_bytes` is denormalized but no longer the enforcement point on its own. A presigned-upload request **atomically reserves** the declared size against quota (`used + pending_reservations + new_request <= quota`) *before* the presigned URL is issued. Reservation has a ~1hr expiry (see Section 6 — reservation TTL vs. resumable uploads is an open decision). Upload completion converts the reservation into confirmed usage; abandoned uploads let the reservation expire and release automatically.
- [ ] **Batch upload = one decision:** a folder/multi-file upload checks *total* batch size against available quota as a single check. Over limit → whole batch rejected upfront (nothing starts). Fits → whole batch reserved atomically and accepted into a server-managed async queue (see Section 6 — reconcile "server-managed queue" vs. direct-to-R2 pacing). Per-file failure within an accepted batch gets **exactly one** automatic retry; on second failure the reserved space is released, the file is marked failed, and the user re-uploads just that file.

**File size / executable / malware policy**
- [ ] **File size caps:** free tier 2GB/file, paid tier 20GB/file, plus a **1TB/account/day** upload-volume cap (24hr rolling, modeled on Drive's abuse-prevention pattern).
- [ ] Size enforcement is **server-side via R2's presigned-policy `content-length-range`**, not client-declared size.
- [ ] **Executables/scripts** cannot be uploaded as loose/standalone files — compiled binaries (`.exe`/`.msi`/`.app`/`.dmg`/`.apk`, detected by **magic bytes**, not extension) and scripts/source (`.sh`/`.py`/`.js`/`.bat`/`.ps1`, detected by content pattern). They **may** be uploaded **inside a compressed archive** (`.zip`/`.rar`/`.7z`/`.tar`/`.gz`) to support legitimate developer backup use.
- [ ] Archives are always allowed and always scanned **inside** (ClamAV archive scanning). If executable/script content is found inside, the upload is **not blocked** but the `File` is flagged `contains_executable_content=True`, and downloaders see a warning before download proceeds.
- [ ] **Malware scanning:** ClamAV's default ~4GB scan ceiling is explicitly raised (config + worker sizing) since scanning is asynchronous — large files just take longer to become `ready`, never silently unscanned. A fast, size-independent **hash-based reputation check** runs as a first pass alongside the full content scan.

**Orphan / multipart cleanup**
- [ ] A **daily Celery beat job** (a) clears expired reservation records and (b) uses R2's multipart-listing API to find incomplete multipart uploads older than ~24h and aborts them, reclaiming partial bytes R2 does not auto-clean.

**Tiers & quota**
- [ ] Tiers: **Free 500GB / Paid 2TB ₹99/month / Paid 5TB ₹249/month** (India launch pricing — a price to validate, not a final commitment; see Section 9).
- [ ] Hard block on quota exceeded (no new uploads); charged on logical size even when content is deduped.

**Payments & invoicing**
- [ ] **Razorpay integration** (Subscriptions API) behind an abstracted `PaymentGateway` interface; monthly + annual billing.
- [ ] Razorpay-native GST invoice generation; `Invoice` model as display/reference layer only.
- [ ] **Refund policy:** no refunds, all sales final (reflected in ToS; refund flows disabled in code).
- [ ] **Failed payments / dunning** handled **entirely via Razorpay's native Subscriptions retry mechanism** — no custom retry logic. Once Razorpay retries are exhausted, the subscription flips to cancelled and enters the same freeze/notification lifecycle below.
- [ ] **Payment rail / region:** Razorpay is India-focused; global pricing, non-India storage regions, and a non-India gateway are deferred as one bundle (Section 3 Non-Goals).

**Subscription lifecycle — expiry-anchored freeze (replaces the earlier abstract grace/cold-storage design)**

| Timing (relative to subscription expiry) | Event |
|---|---|
| 7 days before expiry | Reminder notification |
| 1 day before expiry | Final pre-expiry reminder |
| Expiry | Grace period begins — full access continues, new uploads blocked |
| 1 day after expiry | Notification: subscription has ended |
| 21 days after expiry | Notification: excess-over-free-limit files will be frozen (freeze begins) |
| Every 30 days after that | Recurring reminder while files remain frozen |
| 7 days before permanent deletion | Final warning |
| — | Frozen excess files permanently deleted |

- [ ] **"Frozen" means:** files cannot be viewed, shared, or linked — but **can** be downloaded (to save a personal copy) and **can** be deleted. Not a full lockout.
- [ ] **Which files freeze:** newest-first (oldest content — closest to what the user would have on the free tier — stays accessible longest).
- [ ] **Unfreezing paths:** delete enough files to get back under the limit, re-upgrade to paid, or apply a referral bonus to raise the effective limit.
- [ ] **No cold-storage holding tier:** deduped/shared files cost little to keep regardless; the real cost burden is unique files of a lapsed non-paying user, and ~90+ days of free warnings/grace before any deletion is already generous.

**Referral program**
- [ ] **50GB per successful (OTP-verified) referral, capped at 1TB total,** each 50GB grant expires 180 days from grant date. Tracked as individual `ReferralBonus` records (not a flat cumulative field), so continuous referring keeps storage topped up.
- [ ] **Referral self-fraud: risk explicitly accepted** — only the referrer gains storage (referee gets nothing, so no viral multiplication), the 1TB cap bounds damage, cost is usage-based not account-based, and farmed accounts still generate some ad revenue. Note for future fraud work: shared-device households are a false-positive risk to design around.
- [ ] **Referral-bonus expiry pushing a user over quota** is unified with the subscription freeze/deletion flow above — one mechanism handles both causes of going over quota.

### 5.4 Sharing, Discovery & Channels (P0)

- [ ] `ShareLink` (public, permanent by default with optional sharer-set expiry, optional `password_hash` — password protection is a paid-tier feature) and `SharePermission` (private, specific users).
- [ ] `is_discoverable` flag on File/Folder; Postgres full-text search (personal + discoverable), behind a `SearchService` abstraction for a future OpenSearch swap.
- [ ] **Channels:** `Channel`, `ChannelMembership` (**owner / admin / subscriber** roles), `ChannelPost` (file or folder + caption).
  - Subscribers are strictly view-only. **"Granting posting rights" = the owner promotes a subscriber to admin;** admins can post. (No separate "contributor" role in v1.)
  - Public (discoverable, joinable) vs. private (invite-only) visibility.
  - **Channel post lifecycle:** if the underlying file is deleted, the post shows as unavailable/removed (same as a broken link) — anyone wanting to keep it should have used "add to my storage" while it was live.
  - **Notification fan-out** (e.g. 50,000 subscribers on one post) requires batched/rate-limited Celery dispatch — an engineering/ops requirement, not a product decision.
- [ ] **No user-to-user blocking** — users don't see other users directly except via channel subscriptions; unsubscribe covers "don't want this."
- [ ] **No sharing analytics** (no view/download tracking) in the base product — deliberately reversed only for the deferred creator-monetization program.
- [ ] **Creator monetization program is deferred to post-MVP** (design exists: ~40–50% revenue-share of actual ad revenue on discoverable/public-channel content, self-funding; RazorpayX/UPI/bank payout with KYC and a minimum payout threshold). Reason: paying per view/download incentivizes risky/pirated uploads; the moderation pipeline must be proven at scale first.

### 5.5 Video (P0)

- [ ] **All video goes to R2 first**, like every other file type, and is scanned by the same pipeline immediately on upload (closes the earlier flaw where video bypassed scanning entirely). Cloudflare Stream ingestion is **lazy** — triggered later, on demand.
- [ ] **Private video** (not discoverable, not in a public channel) streams **directly from R2** via a signed URL using HTTP range requests — no Stream, no adaptive bitrate, **zero egress cost** (R2 has no egress fees). Covers the majority case (personal/backup video rarely watched by others).
- [ ] **Video that becomes discoverable or is posted to a public channel** is promoted into Cloudflare Stream (adaptive bitrate + multi-viewer delivery justified there).
- [ ] **Stream as a "hot cache" (candidate for post-POC given added complexity):** `File.last_streamed_at` tracked internally; default playback is the raw R2 version, user clicks **"Watch in HD"** to trigger on-demand Stream promotion; an **hourly Celery job evicts Stream assets unused for 24h**, reverting them to R2-only (re-promotable later). Stream ingestion/encoding is free (only storage + delivery billed), so promote/evict cycles cost only a short re-processing delay. State machine: raw → promoted → evicted → re-promoted.
- [ ] **Custom video player UI** (hls.js on web; native AVPlayer/ExoPlayer on mobile) consumes Stream's HLS manifest directly — not Stream's embedded/branded player.
- [ ] **Free-tier streaming resolution capped (SD); paid tier full/HD.** (See Section 6 — how the SD cap applies to private video served raw from R2 is an open decision.)
- [ ] No social/engagement features (views/likes/comments) in this phase.

### 5.6 Document Viewer (P0)

- [ ] Text-based (`.txt`, `.md`, `.json`, `.yaml`) rendered raw/formatted client-side, no server processing.
- [ ] Images rendered directly from signed R2 URL.
- [ ] PDF rendered via PDF.js (web) / native — no server conversion.
- [ ] `.doc`/`.ppt` rendered via LibreOffice-headless (Celery task) converting each page/slide to an **image** sequence (carousel); **no PDF conversion**, originals stay untouched and downloadable.

### 5.7 Trust & Safety / Content Moderation (P0)

**Universal scanning**
- [ ] **Virus/malware scan: every upload, every file type, always** — before `File.status = ready`.
- [ ] **CSAM scan is universal** — every upload, every file type, in the same pass as the malware scan. Because all files (including video, per 5.5) flow through R2 and are scanned once at upload regardless of destination, extending that pass to always include CSAM detection closes both the earlier legal-exposure question (discoverable-only scope) and the retroactive-scanning gap (content later made discoverable).
- [ ] **Adult-content classifier:** flags for audit trail via `ContentFlag`; runs on discoverable/public content. (See Section 6 — reconcile "flags only, never blocks" with excluding mature content from discovery.)

**CSAM handling — containment decoupled from account punishment**
- [ ] **Case A (caught at upload, before content goes live):** upload silently rejected, never accessible; user sees a **generic, non-specific** message (specific detail would teach evasion); event logged (user, content hash, timestamp) for pattern detection. **No automatic account action** on a single occurrence (could be false positive / accidental upload).
- [ ] **Case B (already-live content, later reported or matched):** **immediate automatic containment** on confirmation — a new `StorageObject` status, `quarantined_legal_hold`, cuts off access for *every* `File` row referencing that content at once (bypassing normal ref-count deletion). Bytes are physically moved to a separate locked-down "legal hold" bucket (belt-and-suspenders alongside the status flag); the owner cannot touch, delete, or modify it. A `CSAMIncident` record tracks detection, confirmation, and reporting status. **Account suspension is not automatic** — it goes to a human moderation review queue tied to the repeat-offender policy, decoupled from containment.
- [ ] **Reporting to authorities** (NCMEC-equivalent) is a **manual, admin-initiated step for v1** — automated reporting APIs require legal registration the client sets up separately.
- [ ] **Admin audit logging** (who triggered a purge, when, why) is a hard dependency of this mechanism, not optional.

**Content reporting — two-step Flag / Report**
- [ ] **Flag** (lightweight, no action, surfaces content for admin visibility) vs. **Report** (deliberate action with consequences).
- [ ] Report types: **copyright/IP claim** (reporter must identify themselves — name, contact, statement — DMCA-style) and **inappropriate content** (anonymous to the public; reporting username still logged internally for abuse-pattern detection).
- [ ] Submitting a **Report** immediately triggers the same **reversible isolation** used for CSAM (access revoked, links locked, nothing deleted) **before** admin review; an admin then confirms (escalate to permanent removal or the CSAM legal-hold path) or reverses (restore access, log resolved/dismissed). Reporter-identity logging provides the accountability that makes pre-review isolation safe. (See Section 6 — single-actor takedown risk on public content is a noted open decision.)

**Piracy / copyright**
- [ ] Reactive DMCA-style takedown + repeat-infringer policy — **not** proactive scanning. Preserves the neutral-intermediary legal position (IT Rules 2021 / DMCA-adjacent safe harbor); proactive fingerprinting can work against that position and isn't required.

**Reporting model**
- [ ] `ContentReport` / `ContentFlag` models (reporter, target, reason, status) + a Django-admin review queue.

### 5.8 Notifications (P0)

- [ ] `Notification` model; in-app + push (FCM) for all types; email (SES) reserved for security/quota-critical events only.
- [ ] Async dispatch via Celery, best-effort (failures don't block the triggering action); batched/rate-limited for large channel fan-out.

### 5.9 Ads (P0)

- [ ] Free tier only (paid tier fully ad-free); backend exposes `user.tier` for client-side AdMob gating — no server-side ad logic.
- [ ] Placements (client-side): dismissible banner (dashboard), interstitial (on **upload** action), video pre-roll (1 ad for 5–10 min videos, +1 per additional 15 min; first ad unskippable ~30s, subsequent skippable after 5–10s).

### 5.10 Device Backup (P0)

- [ ] `auto_backup_enabled`, `backup_wifi_only` user settings; backed-up content lands in a dedicated "Camera Backup" folder; interacts with quota enforcement (pause + notify on quota hit, not silent failure).

### 5.11 Compliance (P0)

- [ ] **DPDPA:** account deletion soft-deletes immediately; hard-deletes (cascading across File/Folder/`StorageObject` ref_count/Cognito/Stream/subscription) after 30 days. Async data-export job (zip to R2, expiring download link). `ConsentLog` tracks ToS/policy-version acceptance.
- [ ] **Legal hold vs. deletion:** the 30-day hard-delete job checks for an active legal hold (e.g. an open `CSAMIncident`) before purging any account or content; if a hold is active, hard-deletion of that content is skipped (the account can still be marked deleted/inaccessible to the user) until the hold is explicitly lifted through the admin/compliance flow.
- [ ] **Shared content on account deletion:** view-only `ShareLink` access is revoked immediately when the owner's account is deleted; content a recipient explicitly "added to their storage" (copy-on-share) persists independently in their own account, unaffected — mirroring how saving media in a messaging app works.
- [ ] **Data residency:** user-selectable storage region at signup/settings; region-pinned R2 buckets (see 5.3 dedup interaction); single-region Django/Postgres app layer with no full DB isolation — confirmed acceptable for B2C.
- [ ] **ToS / Privacy Policy:** a full draft baseline exists (delivered separately as `.docx`), aware of DPDPA, US frameworks, and GDPR/CCPA-adjacent concerns — covering CSAM zero-tolerance, adult-content policy, DMCA-style takedown, subscription/referral terms, deletion/retention, and data residency. Flagged throughout for real legal-counsel review before publication; includes a placeholder for the **Grievance Officer** designation required under India's IT Rules 2021.

### 5.12 Ops (P0)

- [ ] **Django admin (customized):** content-moderation queue, user management, quarantine review, subscription/billing lookup, role-based staff access. Third-party support/ticketing deferred until volume justifies it.
- [ ] **Monitoring — phased:** Phase 1 = Sentry (errors, backend + clients) + CloudWatch (Logs/Metrics/Alarms) + `/health` uptime check + CloudWatch billing alarms. Phase 2 adds Grafana as a unifying dashboard (CloudWatch + Sentry + Postgres) — chosen over Datadog to avoid cost scaling with user volume.
- [ ] **Product analytics:** custom `AnalyticsEvent` model (Postgres, JSONB properties, monthly partitioning) — no third-party vendor; connects into Grafana in Phase 2 for funnel/cohort/retention via direct SQL.

### P1 — Nice-to-Have (fast-follow post-POC)
- [ ] Grafana unifying dashboard (CloudWatch/Sentry/Postgres).
- [ ] Regional language support (Hindi + others).
- [ ] Multi-environment setup (dev/staging/prod).
- [ ] Stream "hot cache" promote/evict state machine (if not built in POC).
- [ ] Lambda-based event processing for webhooks (if Celery/ECS load becomes a bottleneck).

### P2 — Future Considerations (design-compatible, not building now)
- [ ] Desktop sync client (Dropbox-style local folder sync).
- [ ] Creator monetization program (revenue-share on views/downloads for public-channel content).
- [ ] Native mobile apps (iOS/Android).
- [ ] Global launch bundle: global pricing + non-India storage regions + non-India payment gateway.

## 6. Open Questions & Decisions

**Carried open items (from prior review, still undecided):**
- **[Engineering] Scanner-downtime fallback (fail-open vs fail-closed):** if ClamAV or the CSAM scanning service is unavailable, should uploads queue and wait (fail-closed, safer, blocks users) or proceed unscanned (fail-open, faster, risky)? Not yet decided — needs an explicit call before launch.
- **[Engineering] Webhook idempotency:** Razorpay payment webhooks and Cloudflare Stream callbacks can fire more than once on retries. Without idempotency-key handling this risks double-processing (e.g. double-crediting a renewal). Needs a concrete design.
- **[Product] Dormant-account restore specifics:** the exact steps to exit "dormant" status beyond logging in (manual review vs. automated waiting period vs. re-verification) are undecided.

**Contradictions / feature-collisions to resolve before build (documented neutrally — decision still required):**
- **[Storage] Upload transfer model (C):** the design describes both a "presigned direct-to-R2 upload" (client→R2, client paces the transfer) and a "server-managed async upload queue where the client doesn't manage pacing." These cannot both be literally true for the byte transfer without the server proxying uploads (which reintroduces backend egress/bandwidth cost). Decision needed on what "server-managed" governs — the reservation/ordering only, or the transfer itself.
- **[Storage] Reservation TTL vs. resumable uploads (D):** the ~1hr reservation expiry can be shorter than a legitimate large resumable upload on a slow connection, which would expire the reservation mid-upload. Decision needed on reservation lifetime (e.g. flat TTL vs. refreshed on multipart-part activity).
- **[Video] SD resolution cap vs. private-video-direct-from-R2 (E):** serving private video raw from R2 delivers the original file as-is, which cannot enforce a resolution cap without transcoding. Decision needed on whether the SD cap applies only to Stream-promoted/discoverable video, or whether free-tier private video needs a transcoded proxy.
- **[Trust & Safety] Adult classifier "flags only, never blocks" vs. "mature content excluded from discovery" (G):** if the classifier never blocks, untagged adult content stays discoverable until human review. Decision needed on whether a classifier hit should auto-exclude from discovery pending review (using the existing reversible-containment mechanism) or remain audit-only.

**Legal items requiring counsel sign-off:**
- **[Legal] Minimum account age (18, self-attested):** confirm the self-attested-18 posture (prohibit-but-cannot-verify minors) is sufficient under DPDPA/COPPA/GDPR-K once counsel reviews the ToS/Privacy Policy draft.
- **[Legal] App Store iOS review risk:** the discovery/channel feature generally carries App Store review risk; monitor the first submission closely. (The mature-content simplification removes the need for iOS-specific filtering — see 5.5/5.7.)

## 7. Success Metrics

**Leading (POC validation window: first 4–6 weeks post-launch)**
- % of signups completing OTP + first upload (activation).
- Average physical (post-dedup) storage per free vs. paid user — **the critical number** determining whether pricing (₹99/2TB, ₹249/5TB) is sustainable (see Section 9).
- Free-to-paid conversion rate.
- Upload success rate / error rate on the presigned-upload flow.

**Lagging (1–3 months)**
- Actual R2 + Stream cost per user vs. modeled projections (including cross-region-copy cost impact — see 5.3/Section 9).
- Referral-driven signup percentage.
- Ad revenue per free-tier user (validate India eCPM assumptions).

## 8. Timeline Considerations

- POC phase: Railway-hosted, single environment, no mobile client, no creator monetization, no desktop sync — see Non-Goals.
- Migration to AWS ECS Fargate + RDS is a defined future phase, not scheduled yet — trigger point TBD (needs a consumer-scale equivalent defined for this product).
- Pricing (₹99/2TB, ₹249/5TB) is explicitly a **launch price to validate**, not a final commitment.

## 9. Unit Economics Summary

At ₹99/month for 2TB, break-even on raw R2 storage cost alone requires average *physical* (post-dedup) usage to stay under ~77GB per paid user (~3.85% of quota). At ₹249/month for 5TB, the equivalent is ~193GB (~3.86% of quota) — the ratio is consistent across tiers. This is plausible **if** most heavy usage comes from deduped/copied discoverable content rather than unique personal uploads (consistent with the product's low-trust-for-sensitive-data positioning vs. Google Drive/Dropbox), but this is **unvalidated and is the single most important metric to track from week one.**

**New risk to monitor:** per-region deduplication (5.3) means cross-region-popular content is physically copied per region rather than deduped globally — raising its real cost above the original model. Track cross-region copy volume alongside average physical storage.

Mitigations already in scope: 2GB/20GB file-size caps, the 1TB/day upload cap, resolution-capped free-tier streaming, ad-free/HD-streaming/password-links as paid-tier incentives. A-la-carte top-ups and download-speed throttling were explicitly considered and rejected.

## 10. POC Infrastructure Plan (Railway → AWS migration path)

**POC phase (now):**
- Django + DRF backend → Railway
- PostgreSQL → Railway-managed Postgres
- Redis (Celery broker) → Railway-managed Redis
- React + Vite frontend → Railway
- File storage, video, CDN → **Cloudflare (R2, Stream, edge)** — real, not mocked, configured entirely via environment variables so no code changes needed at migration time
- AWS-dependent functionality (currently Cognito) → implemented against `boto3` / official AWS SDKs from day one, even though the app isn't hosted on AWS yet — so the AWS integration code doesn't change at migration, only deployment target and environment variables do
- Goal: minimize infrastructure cost during POC/validation while keeping the codebase migration-ready

**Post-POC (once validated):**
- Django backend → AWS ECS Fargate
- PostgreSQL → AWS RDS (or continue Railway Postgres if still cost-effective — evaluate at migration time)
- Cloudflare R2/Stream/CDN → unchanged, already environment-variable-driven
- Cognito, SES, SNS, CloudWatch → already `boto3`-based, activate fully at migration

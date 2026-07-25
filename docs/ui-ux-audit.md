# Floppy Disk — UI/UX Audit

**Date:** 2026-07-23
**Method:** The app was driven end-to-end with Playwright against a live backend
(Django on SQLite + Vite dev server), registering and logging in as a real user.
Every primary screen was captured at **desktop (1280×900)** and **mobile
(390×844)** and inspected for the five dimensions requested:

1. User experience 2. UI glitches 3. Visual inconsistencies (spacing/padding/gaps)
4. UX improvements (context menus, affordances) 5. Responsiveness (desktop + mobile)

## Screens reviewed

Auth (login / register / forgot), My Files (grid + "Continue watching" carousel),
Shared, Recent, Channels (Discover / Subscribed / trending / browse), Trash,
Upload modal, New-folder modal, Settings (Profile / Account / Security), Video
player modal — each at both breakpoints, plus the mobile nav drawer and bottom
tab bar.

**Overall:** the product is visually polished and genuinely responsive — the
layout switches cleanly from a sidebar+grid on desktop to a bottom-tab + drawer +
2-column grid on mobile, with well-considered modals that become bottom sheets on
mobile. The issues below are the exceptions, not the rule.

## Findings

| # | Sev | Dimension | Screen | Issue | Status |
|---|-----|-----------|--------|-------|--------|
| H1 | High | Inconsistency / UX | Sidebar + drawer (all screens) | Storage meter hardcoded to "4.6 GB of 5 GB — Free" with an alarming **red near-full bar** for every account, incl. brand-new empty & paid (2 TB) ones. Never read `/storage/usage`. | ✅ Fixed |
| M1 | Med | Responsiveness / glitch | Video player (mobile) | Control bar overflowed ~72px on 390px — **HD & fullscreen buttons clipped** off the right edge. | ✅ Fixed |
| H2 | High | UX improvement | File/folder cards | **No per-item context menu / overflow actions.** Cards exposed only Share + Star; no Download, Move-to-trash, or Get-link, and right-click did nothing. | ✅ Fixed |
| M2 | Med | Spacing / consistency | Trash cards | Retention label ("2 days left") **wrapped to two lines** and crowded the Restore/Delete buttons on a narrow card. | ✅ Fixed |
| L1 | Low | UX / production-readiness | Login | Screen prints **demo credentials** ("Demo: aiden.rivera@floppy.disk / password") — fine for a demo, inappropriate for production. | ⏳ Recommended |
| L2 | Low | Consistency | Settings / profile | Profile defaults are hardcoded (`@aiden`, "Product designer. Cloud hoarder.") and show for every new user until edited. | ⏳ Recommended |
| L3 | Low | Glitch | Media thumbnails | A failed poster shows the browser's **broken-image glyph** rather than a neutral placeholder (visible only when the image host is unreachable). | ⏳ Recommended |

### H1 — Storage meter now reflects real usage ✅

Before, the sidebar/drawer meter was pure demo state (`usedGB: 4.6`, total `5`,
tier `Free`) and rendered a red ~92%-full bar for **everyone** — the single most
misleading element in the app, since a new user's account is empty and (with
billing disabled) on the 2 TB plan.

**Fix:** on session start the client now calls `GET /storage/usage` and the meter
shows real `used_bytes` / `quota_bytes` / `tier`. Labels format compactly
(`0 GB of 2 TB`, sub-GB → MB, ≥1024 GB → TB) and the bar is colour-graded by
**real** fill (blue < 75%, amber 75–90%, red > 90%) instead of always-red. Falls
back to the demo values only if the API call fails.
*Files:* `frontend/src/App.jsx` (`loadUsage()`, meter view-model) +
`frontend/src/lib/ui.js` (`fmtStorage`, `TIER_LABELS`). *Verified:* new account
now reads "0 GB of 2 TB", empty blue bar.

### M1 — Mobile video controls no longer clip ✅

The player's control row (play · time · mute · volume-slider · 1× · CC · SD · HD ·
fullscreen) is a fixed `flex` row 420px wide; inside the 350px mobile sheet it
overflowed 72px, clipping HD and fullscreen.

**Fix:** the 64px volume `<input type=range>` (the only range input in the app) is
hidden below 480px via a scoped CSS rule; the adjacent **mute button keeps volume
control reachable**. Row now measures 348px in a 348px container — **0 overflow**.
*Files:* `frontend/src/index.css`. *Verified:* all controls visible on 390px.

### H2 — Context menu on file/folder cards ✅

The clearest UX gap and an explicit ask. Every file/folder card now has a **⋯
overflow button** (next to Share), and **desktop right-click** on a card opens the
same menu at the cursor. Actions are context-aware:

- **Normal item:** Open · Download · Star/Unstar · Share link · Move to trash
  (folders omit Download).
- **Trashed item:** Restore · Delete permanently.

The menu closes on Escape, on click-away, and after an action. Download uses the
real `/files/{id}/download` endpoint for backend files (opens the presigned/direct
URL) and the local media URL for demo items.
*Files:* `frontend/src/App.jsx` (`ctxMenu` state, `openCtxMenu`/`closeCtxMenu`/
`downloadFile`, `ctxMenuView`, per-tile `onContextMenu` + ⋯ button, floating menu),
`frontend/src/api.js` (`fileDownload`). *Verified:* right-click (desktop) and ⋯-tap
(mobile) both open the menu; no page errors; actions fire.

### M2 — Trash card footer wrapping ✅

The retention label now sits on its **own row** above the Restore/Delete buttons
(`flex-wrap` + `flex:1 0 100%` + `nowrap`), so "2 days left" no longer breaks
across two lines or crowds the buttons. *Files:* `frontend/src/App.jsx`.

### L1–L3 ⏳

- **L1:** gate the demo-credentials hint behind a dev/demo flag so it never ships.
- **L2:** seed profile `username`/`bio` empty for new users (or from the backend),
  not from a persona.
- **L3:** give `<img>` thumbnails a neutral background + `object-fit:cover` and an
  `onerror` fallback so a failed poster degrades gracefully.

## Responsiveness verdict

Desktop (1280) and mobile (390) both render cleanly with no horizontal page
scroll. After M1, no control or element overflows its container at 390px. The
mobile drawer, bottom tab bar, FAB upload, and bottom-sheet modals are all
correct. Remaining open items are the three Low findings (L1–L3), all cosmetic /
production-hardening rather than layout breakage.

## Summary of fixes shipped

| # | Fix | Verification |
|---|-----|--------------|
| H1 | Storage meter reads real `/storage/usage` (used/quota/tier), compact TB labels, fill-graded colour | New account shows "0 GB of 2 TB", empty blue bar |
| M1 | Volume slider hidden < 480px so the video control bar fits | Row 348px in 348px container — 0 overflow |
| H2 | Context menu (right-click + ⋯) with Open/Download/Star/Share/Trash (Restore/Delete when trashed) | Menu opens on desktop & mobile, actions fire, no errors |
| M2 | Trash retention label moved to its own row | "2 days left" no longer wraps/crowds buttons |

"""
Expiry-anchored subscription freeze lifecycle (PRD 5.3).

When a subscription lapses, the account effectively drops to the free limit.
After a grace window the excess (newest-first; oldest kept) is *frozen* — not
viewable/shareable but still downloadable/deletable — and, if the account stays
lapsed long enough, the frozen excess is permanently deleted. Re-subscribing
unfreezes everything.

Implemented as pure, `now`-driven functions so the daily Celery job is a thin
wrapper and the behavior is fully testable.
"""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Sum

from apps.notifications.dispatch import notify
from apps.storage.lifecycle import purge_file
from apps.storage.models import File

from .models import Subscription
from .plans import PLANS

FREEZE_GRACE_DAYS = 21   # freeze begins 21 days after expiry
DELETE_GRACE_DAYS = 90   # frozen excess permanently deleted ~90 days after expiry
FREE_LIMIT_BYTES = PLANS["free"]["quota_bytes"]


def _committed_files(user):
    """Owner's live, ready, non-frozen files (what counts toward the limit)."""
    return File.objects.filter(
        owner=user, deleted_at__isnull=True, is_quarantined=False,
        is_frozen=False, status=File.Status.READY,
    )


def freeze_excess(user, *, free_limit_bytes=FREE_LIMIT_BYTES) -> int:
    """Freeze newest-first until usage is within the free limit. Returns count frozen."""
    files = list(_committed_files(user).order_by("created_at"))  # oldest first
    used = sum(f.size_bytes for f in files)
    frozen = 0
    for f in reversed(files):  # newest first
        if used <= free_limit_bytes:
            break
        f.is_frozen = True
        f.save(update_fields=["is_frozen", "updated_at"])
        used -= f.size_bytes
        frozen += 1
    return frozen


def unfreeze_all(user) -> int:
    """Re-subscribe / back-under-limit: thaw every frozen file. Returns count."""
    return File.objects.filter(owner=user, is_frozen=True).update(is_frozen=False)


def process_lapsed_account(user, *, now, free_limit_bytes=FREE_LIMIT_BYTES) -> dict:
    """
    Apply the freeze/delete lifecycle for one user at time `now`.
    Returns {"frozen": n, "deleted": m}.
    """
    sub = Subscription.objects.filter(user=user).order_by("-created_at").first()
    if sub is None or sub.status == Subscription.Status.ACTIVE or sub.current_period_end is None:
        return {"frozen": 0, "deleted": 0}

    ref = sub.current_period_end
    freeze_at = ref + timedelta(days=FREEZE_GRACE_DAYS)
    delete_at = ref + timedelta(days=DELETE_GRACE_DAYS)

    frozen = deleted = 0
    if now >= freeze_at:
        frozen = freeze_excess(user, free_limit_bytes=free_limit_bytes)
        if frozen:
            notify(user, type="quota", title="Some files were frozen",
                   body="Re-subscribe or free up space to restore access.")

    if now >= delete_at:
        for f in list(File.objects.filter(owner=user, is_frozen=True, deleted_at__isnull=True)):
            purge_file(f)
            deleted += 1
        if deleted:
            notify(user, type="quota", title="Frozen files were permanently deleted",
                   body=f"{deleted} file(s) past the retention window were removed.")

    return {"frozen": frozen, "deleted": deleted}


def run_freeze_lifecycle(*, now) -> dict:
    """Daily job: process every account with a non-active latest subscription."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    lapsed_user_ids = (
        Subscription.objects.exclude(status=Subscription.Status.ACTIVE)
        .values_list("user_id", flat=True).distinct()
    )
    totals = {"frozen": 0, "deleted": 0}
    for user in User.objects.filter(id__in=list(lapsed_user_ids)):
        r = process_lapsed_account(user, now=now)
        totals["frozen"] += r["frozen"]
        totals["deleted"] += r["deleted"]
    return totals

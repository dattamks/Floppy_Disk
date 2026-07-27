"""
Referral bonuses (PRD 5.3).

50GB per successful referral, capped at 1TB total per referrer, each grant
expiring 180 days from grant date. Effective quota = base tier quota + the sum
of the referrer's still-active bonuses.
"""
from __future__ import annotations

from datetime import timedelta

from django.db import models, transaction
from django.utils import timezone

from .models import ReferralBonus

GRANT_BYTES = 50 * 1024**3        # 50 GB per referral
CAP_BYTES = 1024**4               # 1 TB total
EXPIRY = timedelta(days=180)


class ReferralError(Exception):
    pass


def active_bonus_bytes(user) -> int:
    agg = ReferralBonus.objects.filter(user=user, expires_at__gt=timezone.now()).aggregate(
        total=models.Sum("bytes")
    )
    return agg["total"] or 0


def effective_quota(user) -> int:
    """Base tier quota plus still-active referral bonuses."""
    return user.quota_bytes + active_bonus_bytes(user)


def apply_referral(*, referee, code: str):
    """
    The `referee` applies a referrer's code. Grants the referrer a bonus.
    Raises ReferralError on invalid/self/duplicate use or when the referrer is capped.

    The referee's one-time `referred_by` is written under a row lock and must
    survive even the *capped* outcome — otherwise (a) the write would be rolled
    back by the error and the referee could re-use their one shot on another
    code, and (b) two concurrent applies could each pass the "already used?"
    check. So the capped branch commits the relationship inside the atomic block
    and only *then* raises, outside it.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if referee.referred_by_id is not None:
        raise ReferralError("You've already used a referral code.")

    normalized = (code or "").strip().upper()
    capped = False
    bonus = None
    with transaction.atomic():
        try:
            referrer = User.objects.select_for_update().get(referral_code=normalized)
        except User.DoesNotExist:
            raise ReferralError("Invalid referral code.")
        if referrer.id == referee.id:
            raise ReferralError("You can't refer yourself.")

        # Re-read the referee under a lock so concurrent applies serialize and
        # the one-code-per-user guard can't be raced.
        referee = User.objects.select_for_update().get(pk=referee.pk)
        if referee.referred_by_id is not None:
            raise ReferralError("You've already used a referral code.")

        referee.referred_by = referrer
        referee.save(update_fields=["referred_by", "updated_at"])
        if active_bonus_bytes(referrer) + GRANT_BYTES > CAP_BYTES:
            capped = True  # relationship recorded, grant nothing
        else:
            bonus = ReferralBonus.objects.create(
                user=referrer, referee=referee, bytes=GRANT_BYTES,
                expires_at=timezone.now() + EXPIRY,
            )

    if capped:
        raise ReferralError("This referrer has reached the referral bonus cap.")
    return bonus

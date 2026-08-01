"""Recompute each user's storage_used_bytes from their actual files.

``storage_used_bytes`` is a denormalized counter kept in step with uploads and
purges (see apps.storage.quota). It's fast, but a missed increment/decrement -
from an old bug, an interrupted job, or a manual DB edit - leaves it drifting
from the truth, which then shows a wrong number in the sidebar meter and can
mis-enforce quota. This command re-sums the real files and repairs the counter.

    python manage.py recompute_storage_usage            # fix every user
    python manage.py recompute_storage_usage --dry-run   # report drift only
    python manage.py recompute_storage_usage --user a@b.c

The truth is the sum of size_bytes over a user's committed files - status READY
or PROCESSING - INCLUDING trashed-but-not-purged ones, because trashed files
keep occupying storage (and counting toward quota) until they're purged. PENDING
uploads are reservations, not committed bytes, so they're excluded - matching how
quota.commit / purge maintain the counter.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import models, transaction

from apps.storage.models import File

User = get_user_model()


def correct_usage(user) -> int:
    """The true committed byte total for `user` (READY + PROCESSING files)."""
    agg = File.objects.filter(
        owner=user, status__in=[File.Status.READY, File.Status.PROCESSING]
    ).aggregate(total=models.Sum("size_bytes"))
    return agg["total"] or 0


class Command(BaseCommand):
    help = "Reconcile users' storage_used_bytes counter with their real files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Report drift without writing any correction.",
        )
        parser.add_argument(
            "--user", default="", help="Only reconcile this user (by email).",
        )

    def handle(self, *args, **opts):
        qs = User.objects.all().order_by("created_at")
        if opts["user"]:
            qs = qs.filter(email=opts["user"])
            if not qs.exists():
                self.stderr.write(self.style.ERROR(f"No user with email {opts['user']!r}."))
                return

        dry = opts["dry_run"]
        checked = drifted = 0
        total_delta = 0
        for user in qs:
            checked += 1
            stored = user.storage_used_bytes
            actual = correct_usage(user)
            if stored == actual:
                continue
            drifted += 1
            delta = actual - stored
            total_delta += delta
            self.stdout.write(
                f"{user.email}: stored={stored} actual={actual} "
                f"drift={delta:+d}{' (dry-run)' if dry else ''}"
            )
            if not dry:
                with transaction.atomic():
                    locked = User.objects.select_for_update().get(pk=user.pk)
                    locked.storage_used_bytes = actual
                    locked.save(update_fields=["storage_used_bytes", "updated_at"])

        verb = "would fix" if dry else "fixed"
        self.stdout.write(
            self.style.SUCCESS(
                f"Checked {checked} user(s); {verb} {drifted} with drift "
                f"(net {total_delta:+d} bytes)."
            )
        )

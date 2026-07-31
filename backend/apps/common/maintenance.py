"""Periodic maintenance - the work Celery beat would do, callable in-process.

Kept broker-free so a single-deployment instance needs no beat scheduler: it's
run by a management command (`manage.py maintenance`) and by an in-process thread
in standalone mode (see apps.common.apps). It calls the very same task functions
beat schedules (running them synchronously). Every job is idempotent and safe to
run repeatedly, so overlapping runs don't corrupt anything.
"""
from __future__ import annotations


def run_all() -> dict:
    """Run every periodic job once. Returns a small summary dict."""
    from apps.accounts.tasks import hard_delete_expired_accounts_task
    from apps.storage.tasks import purge_expired_trash_task, release_expired_reservations_task

    summary = {}
    for name, task in (
        ("purge_trash", purge_expired_trash_task),
        ("release_reservations", release_expired_reservations_task),
        ("hard_delete_accounts", hard_delete_expired_accounts_task),
    ):
        try:
            summary[name] = task()  # a @shared_task called directly runs synchronously
        except Exception as exc:  # noqa: BLE001 - best effort; keep going
            summary[name] = f"error: {exc}"
    return summary

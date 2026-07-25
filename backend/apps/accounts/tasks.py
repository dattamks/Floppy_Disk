"""Scheduled account jobs (Celery beat)."""
from celery import shared_task


@shared_task
def hard_delete_expired_accounts_task():
    """DPDPA: hard-delete accounts soft-deleted > 30 days ago (skips legal holds)."""
    from django.utils import timezone

    from .compliance import hard_delete_expired_accounts
    return hard_delete_expired_accounts(now=timezone.now())

"""Scheduled billing jobs (Celery beat)."""
from celery import shared_task


@shared_task
def run_freeze_lifecycle_task():
    """Process lapsed accounts: freeze excess, purge long-frozen (PRD 5.3)."""
    from django.utils import timezone

    from .freeze import run_freeze_lifecycle
    return run_freeze_lifecycle(now=timezone.now())

"""Scheduled storage jobs (Celery beat)."""
from celery import shared_task


@shared_task
def purge_expired_trash_task():
    """Hard-delete trashed files past their tier retention (PRD 5.3)."""
    from .lifecycle import purge_expired_trash
    return purge_expired_trash()


@shared_task
def release_expired_reservations_task():
    """Release expired upload reservations (reserve-then-commit cleanup)."""
    from .quota import release_expired
    return release_expired()

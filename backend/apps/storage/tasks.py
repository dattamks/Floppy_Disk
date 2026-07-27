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


@shared_task
def transcode_video_task(file_id):
    """Probe + transcode an uploaded video to a browser-playable MP4 (FFmpeg)."""
    from .video_processing import process_video
    return process_video(file_id)

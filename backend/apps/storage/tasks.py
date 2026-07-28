"""Scheduled storage jobs (Celery beat)."""
from celery import shared_task


@shared_task
def purge_expired_trash_task():
    """Hard-delete trashed items past the retention window."""
    from .lifecycle import purge_expired_trash
    return purge_expired_trash()


@shared_task
def release_expired_reservations_task():
    """Release expired upload reservations and clean up abandoned uploads."""
    from .lifecycle import purge_abandoned_uploads
    from .quota import release_expired
    released = release_expired()
    abandoned = purge_abandoned_uploads()
    return {"released": released, "abandoned": abandoned}


@shared_task
def transcode_video_task(file_id):
    """Probe + transcode an uploaded video to a browser-playable MP4 (FFmpeg)."""
    from .video_processing import process_video
    return process_video(file_id)

"""Celery task to rebuild a user's knowledge graph off the request path."""
from celery import shared_task


@shared_task
def rebuild_graph_task(user_id):
    from django.contrib.auth import get_user_model

    from .build import rebuild_user_graph

    user = get_user_model().objects.filter(pk=user_id).first()
    if user is None:
        return {"skipped": "no such user"}
    return rebuild_user_graph(user)


def schedule_rebuild(user) -> None:
    """Warm a user's graph after a content change so the next read is instant.

    In eager mode (the standalone single-process deploy) this is a no-op: doing
    the rebuild inline would slow uploads, and the read-time ``ensure_fresh``
    already rebuilds a stale graph on the next view. In a worker-backed prod
    deploy it dispatches the rebuild asynchronously, moving the cost off both
    the upload and the first graph read. Best-effort - a broker hiccup never
    fails the originating request.
    """
    from django.conf import settings

    if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        return
    try:
        rebuild_graph_task.delay(str(user.id))
    except Exception:  # noqa: BLE001 - warming is best-effort, never fatal.
        pass

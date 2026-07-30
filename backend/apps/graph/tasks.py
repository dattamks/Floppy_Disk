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

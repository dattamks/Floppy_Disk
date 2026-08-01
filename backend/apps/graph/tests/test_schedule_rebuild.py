"""Event-driven graph warming: schedule_rebuild dispatches in prod, no-ops eager."""
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings

from apps.graph.tasks import schedule_rebuild

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def user():
    return User.objects.create_user(email="warm@floppy.disk", password="hunter2pass")


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
def test_noop_in_eager_mode(user):
    # Standalone (eager): don't rebuild inline - read-time ensure_fresh handles it.
    with mock.patch("apps.graph.tasks.rebuild_graph_task.delay") as delay:
        schedule_rebuild(user)
        delay.assert_not_called()


@override_settings(CELERY_TASK_ALWAYS_EAGER=False)
def test_dispatches_async_in_prod(user):
    with mock.patch("apps.graph.tasks.rebuild_graph_task.delay") as delay:
        schedule_rebuild(user)
        delay.assert_called_once_with(str(user.id))


@override_settings(CELERY_TASK_ALWAYS_EAGER=False)
def test_broker_error_is_swallowed(user):
    # A broker hiccup must never fail the originating request.
    with mock.patch("apps.graph.tasks.rebuild_graph_task.delay", side_effect=RuntimeError("no broker")):
        schedule_rebuild(user)  # should not raise

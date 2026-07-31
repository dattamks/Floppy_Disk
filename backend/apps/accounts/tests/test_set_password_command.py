"""The set_password management command — offline account recovery for self-hosts."""
import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command

User = get_user_model()
pytestmark = pytest.mark.django_db


def test_set_password_updates_and_authenticates():
    user = User.objects.create_user(email="recover@floppy.disk", password="OldPass123!")
    call_command("set_password", "recover@floppy.disk", "--password", "N3wStrongPass!")
    user.refresh_from_db()
    assert user.check_password("N3wStrongPass!")
    assert not user.check_password("OldPass123!")


def test_set_password_is_case_insensitive_on_email():
    user = User.objects.create_user(email="mixedcase@floppy.disk", password="OldPass123!")
    # A different-cased email argument still resolves to the same account.
    call_command("set_password", "MixedCase@Floppy.Disk", "--password", "N3wStrongPass!")
    user.refresh_from_db()
    assert user.check_password("N3wStrongPass!")


def test_set_password_unknown_email_errors():
    with pytest.raises(CommandError):
        call_command("set_password", "nobody@nowhere.test", "--password", "whatever123!")


def test_set_password_rejects_weak_password():
    User.objects.create_user(email="weak@floppy.disk", password="OldPass123!")
    with pytest.raises(CommandError):
        call_command("set_password", "weak@floppy.disk", "--password", "123")

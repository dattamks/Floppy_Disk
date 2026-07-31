"""Set (reset) a user's password from the command line.

The primary recovery path for a self-hosted instance where email isn't
configured (or the admin forgot their own password):

    python manage.py set_password you@example.com
    # or, in the standalone container:
    docker compose -f docker-compose.standalone.yml exec floppy \\
        python manage.py set_password you@example.com

Prompts for the new password (twice) unless --password is given.
"""
import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Set a user's password (offline account recovery for self-hosted instances)."

    def add_arguments(self, parser):
        parser.add_argument("email", help="Email of the account to reset.")
        parser.add_argument(
            "--password",
            help="Set the password non-interactively (e.g. for scripts). Omit to be prompted.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        email = options["email"].strip()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f"No account found with email '{email}'.")

        password = options.get("password")
        if not password:
            password = getpass.getpass("New password: ")
            if password != getpass.getpass("Confirm new password: "):
                raise CommandError("Passwords do not match.")
        if not password:
            raise CommandError("Password cannot be empty.")

        try:
            validate_password(password, user)
        except ValidationError as exc:
            raise CommandError("Password rejected: " + "; ".join(exc.messages))

        user.set_password(password)
        user.save(update_fields=["password"])
        self.stdout.write(self.style.SUCCESS(f"Password updated for {user.email}."))

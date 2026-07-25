"""Mint an API key for a user (bootstraps MCP/integrations without a browser)."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import ApiKey


class Command(BaseCommand):
    help = "Create an API key for a user. Prints the key once."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--name", default="cli")
        parser.add_argument("--read-only", action="store_true",
                            help="Mint a read-only key (fetch but not mutate).")

    def handle(self, *args, **opts):
        User = get_user_model()
        try:
            user = User.objects.get(email=opts["email"].lower())
        except User.DoesNotExist:
            raise CommandError(f"No user with email {opts['email']}")
        scopes = "read" if opts["read_only"] else "read,write"
        _key, token = ApiKey.create_for(user, name=opts["name"], scopes=scopes)
        self.stdout.write(self.style.SUCCESS(token))

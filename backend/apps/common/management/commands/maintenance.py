"""Run periodic maintenance once (broker-free). Cron this, or rely on the
in-process scheduler in standalone mode."""
from django.core.management.base import BaseCommand

from apps.common.maintenance import run_all


class Command(BaseCommand):
    help = "Run periodic maintenance jobs once (trash purge, reservation release, account hard-delete)."

    def handle(self, *args, **opts):
        summary = run_all()
        self.stdout.write(self.style.SUCCESS(f"maintenance: {summary}"))

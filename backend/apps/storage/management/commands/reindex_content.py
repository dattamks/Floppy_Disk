"""Backfill full-text search content for existing documents.

New uploads are indexed automatically on completion; run this once after
upgrading to index documents that were uploaded before content search existed:

    python manage.py reindex_content
"""
from django.core.management.base import BaseCommand

from apps.storage.indexing import reindex_file
from apps.storage.models import File


class Command(BaseCommand):
    help = "Extract and cache searchable text for existing document files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all", action="store_true",
            help="Reindex every document, not just those with empty content_text.",
        )

    def handle(self, *args, **options):
        qs = File.objects.filter(kind=File.Kind.DOC, deleted_at__isnull=True,
                                 status=File.Status.READY)
        if not options["all"]:
            qs = qs.filter(content_text="")
        total = indexed = 0
        for file in qs.iterator():
            total += 1
            before = file.content_text
            reindex_file(file)
            if file.content_text and file.content_text != before:
                indexed += 1
        self.stdout.write(self.style.SUCCESS(
            f"Reindexed {indexed} of {total} document(s)."
        ))

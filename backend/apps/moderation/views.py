"""
Moderation API: two-step reporting.

A Flag records intent only. A Report additionally triggers reversible isolation
of the target (a file is quarantined immediately, before human review) — the
reporter's identity is logged so a false Report has a real cost (PRD 5.7).
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.sharing.models import ShareLink
from apps.storage.models import File

from .models import ContentReport
from .serializers import ContentReportSerializer


def _reporter_can_reach(file, reporter) -> bool:
    """Guard against report-by-UUID takedowns of content the reporter can't see.

    Auto-isolation is meant for content that is actually reachable by the
    reporter — their own file, a discoverable file, or one exposed by an active
    public share. Without this, any authenticated user who learns a file's UUID
    can quarantine an arbitrary private file (a one-request takedown, throttled
    only at 10/hour). Isolation stays reversible; this only limits *whose* files
    a report can knock offline.
    """
    if file is None:
        return False
    if file.owner_id == reporter.id or file.is_discoverable:
        return True
    return ShareLink.objects.filter(file=file, revoked=False).exists()


class ReportCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "report"

    def post(self, request):
        serializer = ContentReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(reporter=request.user)

        # A Report immediately + reversibly isolates a file target — but only when
        # the reporter could legitimately reach that file (see _reporter_can_reach).
        if (
            report.kind == ContentReport.Kind.REPORT
            and report.target_type == ContentReport.TargetType.FILE
        ):
            file = File.objects.filter(pk=report.target_id).first()
            if _reporter_can_reach(file, request.user) and not file.is_quarantined:
                File.objects.filter(pk=file.pk, is_quarantined=False).update(is_quarantined=True)

        return Response(ContentReportSerializer(report).data, status=status.HTTP_201_CREATED)

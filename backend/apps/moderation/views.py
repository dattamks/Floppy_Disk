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

from apps.storage.models import File

from .models import ContentReport
from .serializers import ContentReportSerializer


class ReportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ContentReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(reporter=request.user)

        # A Report immediately + reversibly isolates a file target.
        if (
            report.kind == ContentReport.Kind.REPORT
            and report.target_type == ContentReport.TargetType.FILE
        ):
            File.objects.filter(pk=report.target_id, is_quarantined=False).update(is_quarantined=True)

        return Response(ContentReportSerializer(report).data, status=status.HTTP_201_CREATED)

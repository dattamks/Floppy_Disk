"""Public legal surface: policy versions, grievance officer, grievance filing.

Satisfies the *mechanism* required by India's IT Rules 2021 (a reachable
grievance officer + a redressal channel). The officer's real identity and the
policy wording are configured/authored by the business (settings + legal
review); the code surfaces and records them.
"""
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Grievance


class LegalInfoView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({
            "policies": {
                "tos": {"version": settings.TOS_VERSION},
                "privacy": {"version": settings.PRIVACY_VERSION},
            },
            "grievance_officer": {
                "name": settings.GRIEVANCE_OFFICER_NAME,
                "email": settings.GRIEVANCE_OFFICER_EMAIL,
                "address": settings.GRIEVANCE_OFFICER_ADDRESS,
            },
            # The wording of the policies themselves is pending legal-counsel review.
            "note": "Policy wording is subject to legal-counsel review before publication.",
        })


class GrievanceCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        subject = (request.data.get("subject") or "").strip()
        body = (request.data.get("body") or "").strip()
        if not subject or not body:
            return Response({"detail": "subject and body are required."},
                            status=status.HTTP_400_BAD_REQUEST)
        reporter = request.user if getattr(request.user, "is_authenticated", False) else None
        email = (request.data.get("email") or (reporter.email if reporter else "")).strip()
        g = Grievance.objects.create(reporter=reporter, email=email, subject=subject[:200], body=body)
        return Response(
            {
                "ticket": str(g.id),
                "status": g.status,
                "acknowledgement": "Received. We aim to acknowledge within 24 hours and "
                                   "resolve within 15 days, per the IT Rules 2021.",
                "grievance_officer_email": settings.GRIEVANCE_OFFICER_EMAIL,
            },
            status=status.HTTP_201_CREATED,
        )

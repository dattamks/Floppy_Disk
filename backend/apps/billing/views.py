"""Billing API: plans, subscribe, cancel, current subscription, webhook."""
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gateways.base import get_payment_gateway
from .models import Subscription
from .plans import PLANS
from .service import BillingError, cancel, process_webhook_event, subscribe


class PlanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([
            {"code": code, "name": p["name"], "price_paise": p["price_paise"], "quota_bytes": p["quota_bytes"]}
            for code, p in PLANS.items()
        ])


class SubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_code = request.data.get("plan")
        annual = bool(request.data.get("annual"))
        try:
            sub = subscribe(request.user, plan_code=plan_code, annual=annual)
        except BillingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"plan": sub.plan_code, "status": sub.status, "tier": request.user.tier,
             "quota_bytes": request.user.quota_bytes,
             "current_period_end": sub.current_period_end},
            status=status.HTTP_201_CREATED,
        )


class SubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sub = Subscription.objects.filter(user=request.user).order_by("-created_at").first()
        if sub is None:
            return Response({"plan": "free", "status": None})
        return Response({"plan": sub.plan_code, "status": sub.status,
                         "current_period_end": sub.current_period_end})


class CancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sub = cancel(request.user)
        if sub is None:
            return Response({"detail": "No active subscription."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": sub.status, "current_period_end": sub.current_period_end})


class WebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        gw = get_payment_gateway()
        signature = request.headers.get("X-Razorpay-Signature", "")
        if not gw.verify_webhook(payload=request.body, signature=signature):
            return Response({"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            event = gw.parse_webhook_event(payload=request.body)
            newly = process_webhook_event(gateway="razorpay", event=event)
        except BillingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"processed": newly})


class ReferralView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .referrals import CAP_BYTES, active_bonus_bytes
        u = request.user
        return Response({
            "code": u.referral_code,
            "referrals_count": u.referred_users.count(),
            "bonus_bytes_active": active_bonus_bytes(u),
            "bonus_bytes_cap": CAP_BYTES,
        })


class ReferralApplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .referrals import ReferralError, apply_referral
        try:
            bonus = apply_referral(referee=request.user, code=request.data.get("code", ""))
        except ReferralError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"granted_bytes": bonus.bytes}, status=status.HTTP_201_CREATED)

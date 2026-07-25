"""Liveness/readiness endpoint for uptime checks (PRD 5.12 Ops)."""
from django.db import connection
from django.http import JsonResponse


def health(request):
    """Return 200 if the app can reach its database, 503 otherwise."""
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:  # noqa: BLE001 - health check must never raise
        db_ok = False

    status = 200 if db_ok else 503
    return JsonResponse(
        {"status": "ok" if db_ok else "degraded", "database": db_ok},
        status=status,
    )

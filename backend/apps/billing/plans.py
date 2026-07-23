"""Subscription plan catalog (PRD 5.3 — India launch pricing)."""

GB = 1024**3
TB = 1024**4

# code -> plan definition. Prices are in paise (₹1 = 100 paise).
PLANS = {
    "free": {"name": "Free", "price_paise": 0, "quota_bytes": 500 * GB, "tier": "free"},
    "paid_2tb": {"name": "2TB", "price_paise": 9900, "quota_bytes": 2 * TB, "tier": "paid_2tb"},
    "paid_5tb": {"name": "5TB", "price_paise": 24900, "quota_bytes": 5 * TB, "tier": "paid_5tb"},
}


def plan_or_none(code):
    return PLANS.get(code)

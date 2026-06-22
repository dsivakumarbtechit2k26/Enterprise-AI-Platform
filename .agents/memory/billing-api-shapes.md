---
name: Billing API response shapes
description: Exact response shapes for billing endpoints matching TypeScript generated types
---

## GET /api/v1/billing/subscription
Returns `SubscriptionResponse`:
```json
{ "subscription": { "plan_key": "free", "plan_name": "Free", "status": "active", "current_period_end": null, "cancel_at_period_end": false, "stripe_subscription_id": null, "quota": { "api_calls_used": 0, "api_calls_limit": 1000, "users_count": 1, "users_limit": 3, "storage_used_mb": 0, "storage_limit_mb": 1000 } } }
```

## GET /api/v1/platform/plans
Returns `PlanListResponse` — DB-driven from SubscriptionPlan model, NOT hardcoded:
```json
{ "data": [{ "key": "free", "name": "Free", "price_monthly": 0, "stripe_price_id": null, "features": ["Up to 3 users", "1 GB storage", "1,000 API calls/month"], "is_active": true }] }
```
- `price_monthly` is in dollars (cents / 100)
- `features` is a human-readable string array

## POST /api/v1/billing/checkout
Accepts `{ "price_id": "price_xxx" }` only. `success_url` and `cancel_url` are derived from `config('app.frontend_url')` server-side.

## POST /api/v1/billing/portal
No body required. `return_url` derived from `config('app.frontend_url')` server-side.

**Why:** TypeScript types (generated from OpenAPI spec) define the contract. Backend must match these shapes exactly. Frontend `useGetSubscription()` accesses `subData?.subscription` — not `subData?.data`.

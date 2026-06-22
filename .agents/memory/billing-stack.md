---
name: Billing Stack Architecture
description: Laravel Cashier billing system layout, Stripe config requirements, and key design decisions
---

## Cashier model wiring
- `Tenant` uses `BillableTenant` trait (app/Billing/BillableTenant.php) which extends Cashier's `Billable`
- `TenantSubscription` extends Cashier `Subscription` using polymorphic `billable_type/billable_id` columns (not user_id)
- `SubscriptionPlan` uses `key` column (free/trial/professional_monthly/professional_yearly/enterprise) — NO `slug` column
- Plan features stored in `plan_features` table as `feature_key`/`feature_value` rows

## Stripe requirements
- `STRIPE_KEY`, `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` must be set in .env for live Stripe flows
- Without keys: subscription/invoices endpoints work (free plan), checkout/portal return 503 gracefully
- `php artisan billing:create-stripe-plans` syncs plans to Stripe (creates products + prices, writes stripe_price_id back to DB)

## Schedule
- `billing:reset-usage` — runs 1st of every month (resets per-tenant API call counters)
- `cashier:prune-stale-customer-models` — monthly Cashier housekeeping

## Smoke test notes
- All 5 billing endpoints tested and working (2026-06-22)
- CheckPlanFeature returns 402 with upgrade_to suggestion
- UsageTracker uses Cache driver (database by default); increment/reset tested OK

**Why:** Cashier's default `user_id` column doesn't support multi-tenant billing (one customer per tenant, not per user). The polymorphic `billable_type/billable_id` approach lets Tenant be the Stripe customer.

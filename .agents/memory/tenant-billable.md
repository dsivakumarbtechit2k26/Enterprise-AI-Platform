---
name: Tenant billable model
description: How the Tenant model is wired for billing — custom BillableTenant trait, not raw Cashier Billable
---

# Tenant Billable Model

## The Rule
The `Tenant` model uses `App\Billing\BillableTenant` trait, NOT the raw `Laravel\Cashier\Billable`. The custom trait extends Cashier's Billable but overrides `subscriptions()` to return a `MorphMany` pointing to `TenantSubscription::class` on the `billable` morph key.

**Why:** Cashier's built-in `subscriptions()` relationship assumes a `user_id` FK. With polymorphic billing, the relationship must be a `morphMany` on `billable_type`/`billable_id`.

## BillingService
`BillingService::getPlanFeatures($tenant)` is cached in Redis/file cache for 5 minutes under `tenant_plan_features:{tenantId}`. Call `bustPlanCache($tenantId)` after any plan change (webhook, checkout completion, manual admin update).

## Usage quotas
`UsageTracker` uses Redis keys `usage:{tenantId}:api_calls:{Y-m}` with TTL set to end-of-month. The `CheckQuota` middleware (alias: `check_quota`) increments after the response, not before. Monthly reset via `billing:reset-usage` artisan command (scheduled on the 1st).

## Plan feature gating
`CheckPlanFeature` middleware (alias: `plan_feature:feature_key[,required_value]`):
- Without required_value: checks boolean — `filter_var($value, FILTER_VALIDATE_BOOLEAN)`
- With required_value: checks numeric limit — `$value !== 'unlimited' && (int)$value < (int)$required`
- Returns 402 with upgrade suggestion on failure

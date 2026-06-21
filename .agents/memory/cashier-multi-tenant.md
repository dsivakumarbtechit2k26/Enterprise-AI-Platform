---
name: Cashier multi-tenant setup
description: How Laravel Cashier 16 is configured for schema-based multi-tenancy with Tenant as the billable model
---

# Cashier Multi-Tenant Setup

## The Rule
The Cashier-published `subscriptions` migration defaults to `foreignId('user_id')`. For string-keyed Tenant models, replace with polymorphic `billable_type`/`billable_id` columns. Create a custom `TenantSubscription extends Subscription` model with `protected $table = 'subscriptions'` explicitly set (otherwise Laravel derives the table name `tenant_subscriptions` from the class name).

**Why:** Cashier's Subscription model sets `$table = 'subscriptions'` in the parent, but child class name overrides table derivation in some Laravel versions. Explicit table name is always safe.

**How to apply:** Any time a new model extends a Cashier model (Subscription, SubscriptionItem), add an explicit `$table` property.

## Webhook Controller
Always call `parent::__construct()` in the custom StripeWebhookController constructor. The parent constructor conditionally registers the `VerifyWebhookSignature` middleware when `STRIPE_WEBHOOK_SECRET` is set. Skipping this call means webhooks are never signature-verified even in production.

## Return Types
Webhook handler methods must declare `Symfony\Component\HttpFoundation\Response` (not `Illuminate\Http\Response`). Cashier's `successMethod()` and `missingMethod()` return the Symfony base class.

## AppServiceProvider wiring
```php
Cashier::useCustomerModel(Tenant::class);
Cashier::useSubscriptionModel(TenantSubscription::class);
```
Both must be called in `boot()`, not `register()`.

## Cashier columns on tenants table
`stripe_id` — already present via original tenant setup
`pm_type`, `pm_last_four` — added via custom migration (not the Cashier customer_columns migration which targets `users`)

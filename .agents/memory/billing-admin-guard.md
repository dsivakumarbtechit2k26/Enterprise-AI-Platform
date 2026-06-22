---
name: Billing admin guard in BillingController
description: Platform admins have no tenant — BillingController must return early with a null subscription
---

## Rule
`BillingController::subscription()` (and other tenant-dependent billing methods) must check `isPlatformAdmin()` before calling `resolveTenant()`.

```php
if ($this->isPlatformAdmin($request)) {
    return response()->json(['subscription' => null, 'is_platform_admin' => true]);
}
```

`isPlatformAdmin()` checks: `active_tenant_id === 'central'` OR null OR no real tenant row exists.

**Why:** `resolveTenant()` calls `Tenant::findOrFail($tenantId)` where `$tenantId = 'central'` for platform admins. There's no tenant row with id='central', so it throws a ModelNotFoundException → 404 response. Frontend BillingPage was crashing/showing error.

**How to apply:** The BillingPage frontend also handles `subscription === null` by showing a "Platform Administration Account" info card instead of subscription UI.

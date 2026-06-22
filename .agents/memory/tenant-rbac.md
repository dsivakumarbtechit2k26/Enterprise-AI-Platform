---
name: Tenant RBAC Permission Resolution
description: How tenant-scoped permissions work and how to assign roles in tests/tinker
---

## Request flow
1. `ResolveTenantPermissions` middleware reads `X-Tenant-ID` header (or `user.current_tenant_id`)
2. Sets `PermissionRegistrar::setPermissionsTeamId($tenantId)` so Spatie scopes to tenant
3. Sets `request.attributes.active_tenant_id` for downstream controllers

## Assigning roles in tinker/tests
```php
$registrar = app(\Spatie\Permission\PermissionRegistrar::class);
$registrar->setPermissionsTeamId($tenantId);  // MUST set first
$registrar->forgetCachedPermissions();
$user->assignRole(Role::where('name','tenant-admin')->where('team_id',$tenantId)->first());
```

## Roles seeded per tenant (TenantRbacSeeder)
- `tenant-admin` — all permissions except platform-level ones
- `manager` — modules + billing.view + reports
- `member` — CRUD on modules
- `viewer` — read-only

## Key gotcha
The `user_tenants` row (role='owner') is for the central pivot table only.
Spatie role assignment in `model_has_roles` is separate and must be done explicitly.

**Why:** Spatie permission uses `team_id` to scope roles per tenant. A user with `role='owner'` in `user_tenants` does NOT automatically get Spatie permissions — these are two separate systems.

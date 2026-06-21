---
name: Spatie middleware pattern
description: Correct pattern for setting Spatie PermissionRegistrar team context per-request; controllers must not reset it
---

## Rule
The `ResolveTenantPermissions` middleware is the ONLY place that should call `setPermissionsTeamId()`. Controllers must read the `active_tenant_id` request attribute for display purposes only — never call `setPermissionsTeamId()` from a controller.

**Why:** Calling `setPermissionsTeamId()` in a controller after the middleware has already set it correctly will overwrite the team context. The bug manifests as empty roles/permissions when:
1. No `X-Tenant-ID` header → middleware sets team to `'central'`, but forgets to set `active_tenant_id` attribute
2. Controller reads `active_tenant_id` → gets `null`
3. Controller calls `setPermissionsTeamId(null)` → overwrites correct team
4. `getRoleNames()` returns empty because no roles exist with `team_id = null`

**How to apply:**
- `ResolveTenantPermissions::handle()` MUST set both:
  1. `app(PermissionRegistrar::class)->setPermissionsTeamId($teamId)`
  2. `$request->attributes->set('active_tenant_id', $teamId)`
- Use `RbacSeeder::CENTRAL_TEAM` (`'central'`) as fallback when no tenant header, not `null`
- Controllers: read `$request->attributes->get('active_tenant_id')` only for JSON response — never pass it to `setPermissionsTeamId()`
- After the middleware runs, `$user->getRoleNames()` and `$user->getAllPermissions()` use the registrar's current team automatically

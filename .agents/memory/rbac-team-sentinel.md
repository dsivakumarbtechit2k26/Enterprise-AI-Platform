---
name: RBAC team sentinel
description: Spatie teams feature with PostgreSQL — why 'central' string is used instead of NULL for platform-scope roles
---

## Rule
When using spatie/laravel-permission with `teams: true` on PostgreSQL, never use `NULL` as the team_id sentinel for platform-level (non-tenant) roles. Use the string `'central'` instead.

**Why:** PostgreSQL composite primary keys cannot contain NULL values. The `model_has_roles` and `model_has_permissions` tables use `(role_id, model_type, model_id, team_id)` as a composite PK. With MySQL, NULL in a composite PK is silently allowed; PostgreSQL raises `ERROR: null value in column "team_id" violates not-null constraint`.

**How to apply:**
- `RbacSeeder::CENTRAL_TEAM = 'central'` — single constant used everywhere
- All central/platform roles have `team_id = 'central'`
- All `team_id` DB columns are `string` type (not `unsignedBigInteger`) to accommodate both slug-based tenant IDs (`'acme-corp'`) and the `'central'` sentinel
- `AppServiceProvider::boot()` calls `setPermissionsTeamId('central')` by default
- When no `X-Tenant-ID` header is present, `ResolveTenantPermissions` uses `RbacSeeder::CENTRAL_TEAM` as the team

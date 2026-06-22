---
name: Auth /me endpoint format
description: The /me endpoint response shape and tenant auto-resolution logic
---

## Rule
`GET /api/v1/auth/me` must return `{ data: { user, tenant, permissions, roles } }` — NOT `{ data: User }`.

## Tenant resolution
When `user.current_tenant_id` is null, the controller looks up the first row in `user_tenants` for that user, sets `current_tenant_id` on the user (persist), then uses that tenant for permission scoping.

**Why:** Tenant users have no `current_tenant_id` set on first login. Without auto-resolution, `/me` returns `tenant: null`, `activeTenantId` stays null in the frontend store, no `X-Tenant-ID` header is sent, and all tenant-scoped endpoints return 403.

**How to apply:** When modifying the `/me` controller or adding tenant-switching, always ensure `current_tenant_id` is set (or resolved) before calling Spatie permission APIs. The permission team ID must be set to the tenant ID (or CENTRAL_TEAM for platform admins) before calling `getAllPermissions()` / `getRoleNames()`.

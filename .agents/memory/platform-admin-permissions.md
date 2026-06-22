---
name: Platform-admin role permissions
description: The complete set of permissions the platform-admin role must have — broader than originally seeded
---

## Rule
The `platform-admin` role (team_id=central) must include ALL of these permission groups:
- `platform.admin`
- `tenants.*` (view/create/update/delete)
- `billing.view`, `billing.manage`
- `platform_settings.view`, `platform_settings.update`
- `users.*` (view/create/update/delete/invite)
- `roles.*` (view/create/update/delete/assign)
- `permissions.view`, `permissions.assign`
- `settings.view`, `settings.update`
- `modules.view`, `modules.manage`
- `reports.view`, `reports.create`, `reports.export`
- `audit_logs.view`

**Why:** The original seeder only had tenants/billing/platform_settings/users.view/audit_logs. The roles/* and permissions/* were missing, causing 403 on GET /roles and GET /permissions for admin users. Without settings.* and modules.*, admins can't access their own settings pages.

**How to apply:** Any time the RbacSeeder is re-run, it uses syncPermissions() which replaces the role's perms entirely. The updated seeder in database/seeders/RbacSeeder.php is authoritative.

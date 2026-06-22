<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds all platform-wide permissions and central roles.
 *
 * Central roles (team_id = 'central'):
 *   - super-admin     : all permissions
 *   - platform-admin  : tenant + billing management
 *
 * 'central' is the sentinel team_id for the platform (non-tenant) scope.
 * PostgreSQL composite PKs cannot contain NULL values, so we use 'central'
 * instead of NULL for the global scope.
 *
 * Tenant-scoped roles are seeded by TenantRbacSeeder, called
 * when a tenant is provisioned via TenantController.
 */
class RbacSeeder extends Seeder
{
    public const CENTRAL_TEAM = 'central';

    public function run(): void
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId(self::CENTRAL_TEAM);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $guard = 'sanctum';

        // ── 1. Seed all permissions (global definitions) ──────────────────────
        $permissions = $this->permissionList();
        foreach ($permissions as $name) {
            Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => $guard]
            );
        }

        // ── 2. Central roles (team_id = 'central') ────────────────────────────

        // super-admin: unrestricted access to everything
        $superAdmin = Role::firstOrCreate(
            ['name' => 'super-admin', 'guard_name' => $guard, 'team_id' => self::CENTRAL_TEAM]
        );
        $superAdmin->syncPermissions(Permission::all());

        // platform-admin: manage tenants, billing, platform settings
        $platformAdmin = Role::firstOrCreate(
            ['name' => 'platform-admin', 'guard_name' => $guard, 'team_id' => self::CENTRAL_TEAM]
        );
        $platformAdmin->syncPermissions([
            'platform.admin',
            'tenants.view', 'tenants.create', 'tenants.update', 'tenants.delete',
            'billing.view', 'billing.manage',
            'platform_settings.view', 'platform_settings.update',
            'users.view', 'users.create', 'users.update', 'users.delete', 'users.invite',
            'roles.view', 'roles.create', 'roles.update', 'roles.delete', 'roles.assign',
            'permissions.view', 'permissions.assign',
            'settings.view', 'settings.update',
            'modules.view', 'modules.manage',
            'reports.view', 'reports.create', 'reports.export',
            'audit_logs.view',
        ]);

        $this->command->info('✓ Seeded ' . count($permissions) . ' permissions + 2 central roles (team=central).');
    }

    /**
     * Canonical list of all platform permissions.
     * Format: {resource}.{action}
     */
    public static function permissionList(): array
    {
        $modules = [
            'crm', 'hrm', 'inventory', 'accounting',
            'tasks', 'projects', 'pos', 'warehouse', 'ecommerce',
        ];

        $permissions = [];

        foreach ($modules as $module) {
            foreach (['view', 'create', 'update', 'delete', 'export'] as $action) {
                $permissions[] = "{$module}.{$action}";
            }
        }

        foreach (['view', 'create', 'update', 'delete', 'invite'] as $action) {
            $permissions[] = "users.{$action}";
        }

        foreach (['view', 'create', 'update', 'delete', 'assign'] as $action) {
            $permissions[] = "roles.{$action}";
        }

        $permissions[] = 'permissions.view';
        $permissions[] = 'permissions.assign';
        $permissions[] = 'field_permissions.manage';

        foreach (['view', 'create', 'export'] as $action) {
            $permissions[] = "reports.{$action}";
        }

        $permissions[] = 'settings.view';
        $permissions[] = 'settings.update';
        $permissions[] = 'billing.view';
        $permissions[] = 'billing.manage';
        $permissions[] = 'modules.view';
        $permissions[] = 'modules.manage';

        foreach (['view', 'create', 'update', 'delete'] as $action) {
            $permissions[] = "tenants.{$action}";
        }

        $permissions[] = 'platform_settings.view';
        $permissions[] = 'platform_settings.update';
        $permissions[] = 'audit_logs.view';
        $permissions[] = 'platform.admin';

        return $permissions;
    }
}

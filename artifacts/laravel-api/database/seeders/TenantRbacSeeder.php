<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds default roles for a newly provisioned tenant.
 *
 * Usage: (new TenantRbacSeeder())->run('acme-corp')
 *
 * Roles created (scoped to team_id = $tenantId):
 *  - tenant-admin : full access within the tenant
 *  - manager      : CRUD on modules + reports, no settings/billing/roles mgmt
 *  - member       : view + create/update on modules
 *  - viewer       : read-only
 */
class TenantRbacSeeder extends Seeder
{
    public function run(string $tenantId): void
    {
        $registrar = app(PermissionRegistrar::class);
        $registrar->setPermissionsTeamId($tenantId);
        $registrar->forgetCachedPermissions();

        $guard = 'sanctum';

        // ── tenant-admin ──────────────────────────────────────────────────────
        $tenantAdmin = Role::firstOrCreate([
            'name'       => 'tenant-admin',
            'guard_name' => $guard,
            'team_id'    => $tenantId,
        ]);
        $tenantAdmin->syncPermissions(Permission::whereNotIn('name', [
            'tenants.view', 'tenants.create', 'tenants.update', 'tenants.delete',
            'platform_settings.view', 'platform_settings.update',
        ])->pluck('name')->toArray());

        // ── manager ───────────────────────────────────────────────────────────
        $manager = Role::firstOrCreate([
            'name'       => 'manager',
            'guard_name' => $guard,
            'team_id'    => $tenantId,
        ]);
        $manager->syncPermissions(array_merge(
            $this->modulePermissions(),
            [
                'users.view', 'users.invite',
                'roles.view',
                'permissions.view',
                'reports.view', 'reports.create', 'reports.export',
                'settings.view',
                'billing.view',
                'modules.view',
                'audit_logs.view',
            ]
        ));

        // ── member ────────────────────────────────────────────────────────────
        $member = Role::firstOrCreate([
            'name'       => 'member',
            'guard_name' => $guard,
            'team_id'    => $tenantId,
        ]);
        $member->syncPermissions($this->memberPermissions());

        // ── viewer ────────────────────────────────────────────────────────────
        $viewer = Role::firstOrCreate([
            'name'       => 'viewer',
            'guard_name' => $guard,
            'team_id'    => $tenantId,
        ]);
        $viewer->syncPermissions($this->viewOnlyPermissions());

        // Restore default team context
        $registrar->setPermissionsTeamId(RbacSeeder::CENTRAL_TEAM);
        $registrar->forgetCachedPermissions();

        $this->command?->info("✓ Seeded tenant RBAC roles for: {$tenantId}");
    }

    private function modulePermissions(): array
    {
        $modules = ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects', 'pos', 'warehouse', 'ecommerce'];
        $perms   = [];
        foreach ($modules as $m) {
            foreach (['view', 'create', 'update', 'delete', 'export'] as $a) {
                $perms[] = "{$m}.{$a}";
            }
        }
        return $perms;
    }

    private function memberPermissions(): array
    {
        $modules = ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects', 'pos', 'warehouse', 'ecommerce'];
        $perms   = [];
        foreach ($modules as $m) {
            foreach (['view', 'create', 'update'] as $a) {
                $perms[] = "{$m}.{$a}";
            }
        }
        $perms[] = 'reports.view';
        $perms[] = 'settings.view';
        return $perms;
    }

    private function viewOnlyPermissions(): array
    {
        $modules = ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects', 'pos', 'warehouse', 'ecommerce'];
        $perms   = [];
        foreach ($modules as $m) {
            $perms[] = "{$m}.view";
        }
        $perms[] = 'reports.view';
        return $perms;
    }
}

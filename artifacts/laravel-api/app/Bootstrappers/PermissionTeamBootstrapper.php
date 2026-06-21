<?php

declare(strict_types=1);

namespace App\Bootstrappers;

use Database\Seeders\RbacSeeder;
use Spatie\Permission\PermissionRegistrar;
use Stancl\Tenancy\Contracts\TenancyBootstrapper;
use Stancl\Tenancy\Contracts\Tenant;

/**
 * Sets the spatie/laravel-permission team ID to the current tenant's
 * slug so that all role/permission checks are automatically scoped to
 * the active tenant.
 *
 * Reverts to 'central' (the platform-level sentinel) when tenancy ends.
 */
class PermissionTeamBootstrapper implements TenancyBootstrapper
{
    public function __construct(protected PermissionRegistrar $registrar) {}

    public function bootstrap(Tenant $tenant): void
    {
        $this->registrar->setPermissionsTeamId((string) $tenant->getKey());
        $this->registrar->forgetCachedPermissions();
    }

    public function revert(): void
    {
        $this->registrar->setPermissionsTeamId(RbacSeeder::CENTRAL_TEAM);
        $this->registrar->forgetCachedPermissions();
    }
}

<?php

declare(strict_types=1);

use Stancl\Tenancy\Database\Models\Domain;

return [
    'tenant_model' => \App\Models\Tenant::class,
    'id_generator' => Stancl\Tenancy\UUIDGenerator::class,

    'domain_model' => Domain::class,

    'central_domains' => array_filter([
        '127.0.0.1',
        'localhost',
        env('REPLIT_DEV_DOMAIN'),
    ]),

    'bootstrappers' => [
        Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper::class,
        Stancl\Tenancy\Bootstrappers\CacheTenancyBootstrapper::class,
        Stancl\Tenancy\Bootstrappers\FilesystemTenancyBootstrapper::class,
        Stancl\Tenancy\Bootstrappers\QueueTenancyBootstrapper::class,
        App\Bootstrappers\PermissionTeamBootstrapper::class,
    ],

    'database' => [
        'central_connection' => 'central',
        // Use 'pgsql' (not 'tenant') as the template so that
        // DatabaseManager::purgeTenantConnection() (which unsets
        // config['database.connections.tenant']) doesn't wipe out the template
        // that DatabaseConfig::manager() reads to determine the driver.
        'template_tenant_connection' => 'pgsql',

        // Schema prefix: tenant_{uuid}
        'prefix' => 'tenant_',
        'suffix' => '',

        'managers' => [
            // Schema-based isolation — all tenants share one PostgreSQL server
            'pgsql' => Stancl\Tenancy\TenantDatabaseManagers\PostgreSQLSchemaManager::class,
            'sqlite' => Stancl\Tenancy\TenantDatabaseManagers\SQLiteDatabaseManager::class,
        ],
    ],

    'cache' => [
        'tag_base' => 'tenant',
    ],

    'filesystem' => [
        'suffix_base' => 'tenant',
        'disks' => [
            'local',
            'public',
        ],
        'root_override' => [
            'local' => '%storage_path%/app/',
            'public' => '%storage_path%/app/public/',
        ],
        'suffix_storage_path' => true,
        'asset_helper_tenancy' => true,
    ],

    'redis' => [
        'prefix_base' => 'tenant',
        'prefixed_connections' => [],
    ],

    'features' => [
        Stancl\Tenancy\Features\UserImpersonation::class,
    ],

    'routes' => true,

    'migration_parameters' => [
        '--force' => true,
        '--path' => [database_path('migrations/tenant')],
        '--realpath' => true,
    ],

    'seeder_parameters' => [
        '--class' => 'TenantDatabaseSeeder',
    ],
];

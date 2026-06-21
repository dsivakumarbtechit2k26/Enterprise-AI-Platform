<?php

declare(strict_types=1);

use Illuminate\Support\Str;

return [

    'default' => env('DB_CONNECTION', 'central'),

    'connections' => [

        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DB_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
        ],

        // Central platform database (uses Replit's PostgreSQL via DATABASE_URL)
        'central' => [
            'driver' => 'pgsql',
            'url' => env('DATABASE_URL', env('DB_URL')),
            'host' => env('PGHOST', env('DB_HOST', '127.0.0.1')),
            'port' => env('PGPORT', env('DB_PORT', '5432')),
            'database' => env('PGDATABASE', env('DB_DATABASE', 'postgres')),
            'username' => env('PGUSER', env('DB_USERNAME', 'postgres')),
            'password' => env('PGPASSWORD', env('DB_PASSWORD', '')),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'central',
            'sslmode' => 'prefer',
        ],

        // Tenant connection — dynamically switched by stancl/tenancy
        'tenant' => [
            'driver' => 'pgsql',
            'url' => env('DATABASE_URL', env('DB_URL')),
            'host' => env('PGHOST', env('DB_HOST', '127.0.0.1')),
            'port' => env('PGPORT', env('DB_PORT', '5432')),
            'database' => env('PGDATABASE', env('DB_DATABASE', 'postgres')),
            'username' => env('PGUSER', env('DB_USERNAME', 'postgres')),
            'password' => env('PGPASSWORD', env('DB_PASSWORD', '')),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public', // overridden per-tenant at runtime
            'sslmode' => 'prefer',
        ],

        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DATABASE_URL', env('DB_URL')),
            'host' => env('PGHOST', env('DB_HOST', '127.0.0.1')),
            'port' => env('PGPORT', env('DB_PORT', '5432')),
            'database' => env('PGDATABASE', env('DB_DATABASE', 'postgres')),
            'username' => env('PGUSER', env('DB_USERNAME', 'postgres')),
            'password' => env('PGPASSWORD', env('DB_PASSWORD', '')),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ],

    ],

    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],

    'redis' => [
        'client' => env('REDIS_CLIENT', 'phpredis'),
        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', Str::slug((string) env('APP_NAME', 'laravel')).'-database-'),
        ],
        'default' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],
        'cache' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
        ],
    ],

];

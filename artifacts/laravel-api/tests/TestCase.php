<?php

namespace Tests;

use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use DatabaseMigrations;

    /**
     * After the application is freshly booted (but before DatabaseMigrations
     * runs artisan migrate:fresh), redirect both the default 'sqlite' connection
     * and the 'central' connection to the SAME temp-file SQLite database.
     *
     * This ensures that migrations declaring `protected $connection = 'central'`
     * (audit_logs, tenants, subscriptions, etc.) land in the same database as
     * user/token tables, so all assertions work without a live PostgreSQL server.
     */
    protected function refreshApplication(): void
    {
        parent::refreshApplication();

        $dbPath = sys_get_temp_dir() . '/laravel_test_' . getmypid() . '.sqlite';

        if (! file_exists($dbPath)) {
            touch($dbPath);
        }

        $cfg = [
            'driver'                  => 'sqlite',
            'database'                => $dbPath,
            'prefix'                  => '',
            'foreign_key_constraints' => false,
        ];

        config([
            'database.default'             => 'sqlite',
            'database.connections.sqlite'  => $cfg,
            'database.connections.central' => $cfg,
        ]);

        $this->app['db']->purge('sqlite');
        $this->app['db']->purge('central');
    }
}

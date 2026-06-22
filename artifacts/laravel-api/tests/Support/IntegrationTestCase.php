<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Base class for integration tests that need real database access.
 *
 * The central PostgreSQL connection is remapped to a temporary SQLite file so
 * that tests run in complete isolation without a live PostgreSQL server. All
 * migrations are executed fresh before each test class and the file is deleted
 * afterward.
 *
 * Use this class (instead of the default TestCase) when your test must hit a
 * real HTTP endpoint and the controller path touches the 'central' DB
 * connection (User, Tenant, AuditLog, etc.).
 */
abstract class IntegrationTestCase extends TestCase
{
    private string $sqliteFile;

    protected function setUp(): void
    {
        // Boot the application first — config() / DB:: helpers become available.
        parent::setUp();

        $this->sqliteFile = sys_get_temp_dir()
            . '/laravel_int_' . getmypid() . '_' . spl_object_id($this) . '.sqlite';

        touch($this->sqliteFile);

        $sqliteConfig = [
            'driver'                  => 'sqlite',
            'url'                     => null,
            'database'                => $this->sqliteFile,
            'prefix'                  => '',
            'foreign_key_constraints' => false,
        ];

        // Point BOTH the default 'sqlite' connection and the 'central' connection
        // at the same physical file so they share schema and data.
        config([
            'database.default'                     => 'sqlite',
            'database.connections.sqlite.database' => $this->sqliteFile,
            'database.connections.central'         => $sqliteConfig,
        ]);

        DB::purge('sqlite');
        DB::purge('central');

        // Drop everything and re-migrate so each test starts clean.
        $this->artisan('migrate:fresh', ['--force' => true]);
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        DB::purge('sqlite');
        DB::purge('central');

        if (isset($this->sqliteFile) && file_exists($this->sqliteFile)) {
            @unlink($this->sqliteFile);
        }
    }
}

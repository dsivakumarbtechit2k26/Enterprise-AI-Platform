<?php

declare(strict_types=1);

use App\Models\Tenant;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

if (! function_exists('current_tenant')) {
    /**
     * Return the currently active tenant, or null in central context.
     */
    function current_tenant(): ?Tenant
    {
        try {
            return tenancy()->tenant instanceof Tenant ? tenancy()->tenant : null;
        } catch (\Throwable) {
            return null;
        }
    }
}

if (! function_exists('central_db')) {
    /**
     * Return the central database connection.
     */
    function central_db(): Connection
    {
        return DB::connection('central');
    }
}

if (! function_exists('tenant_db')) {
    /**
     * Return the current tenant database connection (tenant schema).
     */
    function tenant_db(): Connection
    {
        return DB::connection('tenant');
    }
}

if (! function_exists('platform_setting')) {
    /**
     * Get a platform setting value.
     */
    function platform_setting(string $key, mixed $default = null): mixed
    {
        return app(\App\Services\PlatformSettingsService::class)->get($key, $default);
    }
}

<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\UsageTracker;
use Illuminate\Console\Command;

/**
 * Artisan command: php artisan billing:reset-usage
 *
 * Resets all per-tenant monthly API call counters.
 * Scheduled to run on the first of each month at midnight.
 */
class ResetUsageCountersCommand extends Command
{
    protected $signature   = 'billing:reset-usage {--tenant= : Reset a specific tenant only}';
    protected $description = 'Reset monthly API usage counters for all tenants (or a single tenant)';

    public function handle(UsageTracker $tracker): int
    {
        $tenantId = $this->option('tenant');

        if ($tenantId) {
            $tracker->resetApiCalls($tenantId);
            $this->info("Usage counters reset for tenant: {$tenantId}");
            return self::SUCCESS;
        }

        $count = 0;
        Tenant::chunk(100, function ($tenants) use ($tracker, &$count) {
            foreach ($tenants as $tenant) {
                $tracker->resetApiCalls($tenant->id);
                $count++;
            }
        });

        $this->info("Usage counters reset for {$count} tenants.");

        return self::SUCCESS;
    }
}

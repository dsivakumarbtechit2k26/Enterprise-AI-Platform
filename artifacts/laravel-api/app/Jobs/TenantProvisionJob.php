<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class TenantProvisionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function __construct(
        public readonly string $tenantId,
        public readonly array  $ownerData = [],
    ) {}

    public function handle(): void
    {
        $tenant = Tenant::find($this->tenantId);

        if (! $tenant) {
            Log::warning('TenantProvisionJob: tenant not found', ['tenant_id' => $this->tenantId]);
            return;
        }

        Log::info('TenantProvisionJob: provisioning tenant', [
            'tenant_id' => $this->tenantId,
            'name'      => $tenant->name,
        ]);

        // Tenancy will create the schema and run migrations automatically
        // via the TenancyServiceProvider events (CreateDatabase → MigrateDatabase).
        // This job handles any additional post-provision work.

        $tenant->update(['status' => 'active']);

        Log::info('TenantProvisionJob: tenant provisioned successfully', [
            'tenant_id' => $this->tenantId,
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('TenantProvisionJob: failed', [
            'tenant_id' => $this->tenantId,
            'error'     => $exception->getMessage(),
        ]);

        Tenant::where('id', $this->tenantId)->update(['status' => 'provision_failed']);
    }
}

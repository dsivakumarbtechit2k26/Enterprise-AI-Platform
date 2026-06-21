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

    public function handle(\App\Services\BillingService $billing): void
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

        // 1. Create Stripe customer (gracefully skips if Stripe not configured)
        try {
            $billing->ensureStripeCustomer($tenant);
        } catch (\Throwable $e) {
            Log::warning('TenantProvisionJob: Stripe customer creation skipped', [
                'tenant_id' => $this->tenantId,
                'reason'    => $e->getMessage(),
            ]);
        }

        // 2. Assign free plan
        $billing->assignFreePlan($tenant);

        // 3. Activate tenant
        $tenant->update(['status' => 'active']);

        Log::info('TenantProvisionJob: tenant provisioned successfully', [
            'tenant_id' => $this->tenantId,
            'plan'      => 'free',
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

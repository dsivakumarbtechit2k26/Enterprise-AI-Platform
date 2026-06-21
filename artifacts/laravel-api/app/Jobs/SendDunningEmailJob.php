<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Mail\DunningEmail;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class SendDunningEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 3;
    public int $timeout = 60;

    public function __construct(
        public readonly string $tenantId,
        public readonly int    $attemptNumber, // 1, 2, or 3
    ) {}

    public function handle(): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        // Find the tenant admin (first owner/admin in user_tenants)
        $adminUserId = DB::connection('central')
            ->table('user_tenants')
            ->where('tenant_id', $this->tenantId)
            ->where('role', 'owner')
            ->value('user_id');

        if (! $adminUserId) {
            return;
        }

        $admin = User::find($adminUserId);
        if (! $admin) {
            return;
        }

        Mail::to($admin->email)->send(new DunningEmail($tenant, $this->attemptNumber));
    }

    public function failed(\Throwable $exception): void
    {
        \Illuminate\Support\Facades\Log::error('SendDunningEmailJob failed', [
            'tenant_id' => $this->tenantId,
            'attempt'   => $this->attemptNumber,
            'error'     => $exception->getMessage(),
        ]);
    }
}

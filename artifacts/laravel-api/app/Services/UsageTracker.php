<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class UsageTracker
{
    // ── API call counters (Redis) ─────────────────────────────────────────────

    public function incrementApiCalls(string $tenantId): void
    {
        $key = $this->apiCallsKey($tenantId);
        Redis::incr($key);
        Redis::expireat($key, $this->endOfMonth());
    }

    public function getApiCallsThisMonth(string $tenantId): int
    {
        return (int) (Redis::get($this->apiCallsKey($tenantId)) ?? 0);
    }

    public function resetApiCalls(string $tenantId): void
    {
        Redis::del($this->apiCallsKey($tenantId));
    }

    // ── Active user count (DB) ────────────────────────────────────────────────

    public function getActiveUserCount(string $tenantId): int
    {
        return DB::connection('central')
            ->table('user_tenants')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->count();
    }

    // ── Storage (placeholder — real impl would query object storage) ──────────

    public function getStorageGb(string $tenantId): float
    {
        return (float) (Redis::get($this->storageKey($tenantId)) ?? 0);
    }

    public function setStorageGb(string $tenantId, float $gb): void
    {
        Redis::set($this->storageKey($tenantId), $gb);
    }

    // ── Key helpers ───────────────────────────────────────────────────────────

    private function apiCallsKey(string $tenantId): string
    {
        $month = now()->format('Y-m');
        return "usage:{$tenantId}:api_calls:{$month}";
    }

    private function storageKey(string $tenantId): string
    {
        return "usage:{$tenantId}:storage_gb";
    }

    private function endOfMonth(): int
    {
        return now()->endOfMonth()->addSecond()->timestamp;
    }
}

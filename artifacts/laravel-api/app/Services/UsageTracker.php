<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Tracks per-tenant resource usage.
 *
 * API call counters and storage figures are stored in the Laravel cache
 * (configured via CACHE_STORE — defaults to 'database', works with any driver).
 * Active-user counts are read directly from the DB.
 */
class UsageTracker
{
    // ── API call counters ─────────────────────────────────────────────────────

    public function incrementApiCalls(string $tenantId): void
    {
        $key = $this->apiCallsKey($tenantId);
        $ttl = $this->ttlToEndOfMonth();

        if (Cache::has($key)) {
            Cache::increment($key);
        } else {
            Cache::put($key, 1, $ttl);
        }
    }

    public function getApiCallsThisMonth(string $tenantId): int
    {
        return (int) (Cache::get($this->apiCallsKey($tenantId), 0));
    }

    public function resetApiCalls(string $tenantId): void
    {
        Cache::forget($this->apiCallsKey($tenantId));
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

    // ── Storage tracking ──────────────────────────────────────────────────────

    public function getStorageGb(string $tenantId): float
    {
        return (float) Cache::get($this->storageKey($tenantId), 0);
    }

    public function setStorageGb(string $tenantId, float $gb): void
    {
        Cache::put($this->storageKey($tenantId), $gb, Carbon::now()->addYear());
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

    private function ttlToEndOfMonth(): int
    {
        return max(1, (int) now()->endOfMonth()->addSecond()->diffInSeconds(now()));
    }
}

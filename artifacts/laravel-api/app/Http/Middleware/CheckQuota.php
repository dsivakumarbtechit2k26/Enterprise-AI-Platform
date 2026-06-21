<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Services\BillingService;
use App\Services\UsageTracker;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces per-tenant quota limits across multiple dimensions:
 *   - Monthly API call quota (every request)
 *   - Max active users   (POST to user-management routes)
 *   - Max storage GB     (POST/PUT to file-upload routes)
 *
 * Middleware alias: check_quota
 */
class CheckQuota
{
    private const USER_ROUTE_PATTERNS   = ['/users', '/team-members', '/invitations'];
    private const UPLOAD_ROUTE_PATTERNS = ['/files', '/attachments', '/uploads', '/documents'];

    public function __construct(
        private readonly UsageTracker   $tracker,
        private readonly BillingService $billing,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $request->attributes->get('active_tenant_id');

        if (! $tenantId || $tenantId === 'central') {
            return $next($request);
        }

        $tenant = Tenant::find($tenantId);
        if (! $tenant) {
            return $next($request);
        }

        $features = $this->billing->getPlanFeatures($tenant);

        // ── 1. Monthly API call quota ─────────────────────────────────────────
        $apiLimit = $features['api_calls_month'] ?? 'unlimited';
        if ($apiLimit !== 'unlimited') {
            $current = $this->tracker->getApiCallsThisMonth($tenantId);
            if ($current >= (int) $apiLimit) {
                return $this->deny(
                    type: 'api_calls_month',
                    title: 'Monthly API Quota Exceeded',
                    detail: "Your plan allows {$apiLimit} API calls per month. Upgrade to increase your limit.",
                    current: $current,
                    limit: (int) $apiLimit,
                );
            }
        }

        // ── 2. Max active users (enforced on user-creation requests) ──────────
        if ($request->isMethod('POST') && $this->matchesPatterns($request, self::USER_ROUTE_PATTERNS)) {
            $maxUsers = $features['max_users'] ?? 'unlimited';
            if ($maxUsers !== 'unlimited') {
                $currentUsers = $this->tracker->getActiveUserCount($tenantId);
                if ($currentUsers >= (int) $maxUsers) {
                    return $this->deny(
                        type: 'max_users',
                        title: 'User Limit Reached',
                        detail: "Your plan supports up to {$maxUsers} active users. Upgrade to add more team members.",
                        current: $currentUsers,
                        limit: (int) $maxUsers,
                    );
                }
            }
        }

        // ── 3. Max storage GB (enforced on file-upload requests) ──────────────
        if (in_array($request->method(), ['POST', 'PUT'], true) && $this->matchesPatterns($request, self::UPLOAD_ROUTE_PATTERNS)) {
            $maxStorage = $features['max_storage_gb'] ?? 'unlimited';
            if ($maxStorage !== 'unlimited') {
                $currentGb = $this->tracker->getStorageGb($tenantId);
                if ($currentGb >= (float) $maxStorage) {
                    return $this->deny(
                        type: 'max_storage_gb',
                        title: 'Storage Limit Reached',
                        detail: "Your plan includes {$maxStorage} GB of storage. Remove files or upgrade to add more.",
                        current: (int) round($currentGb * 1000), // MB
                        limit: (int) ($maxStorage * 1000),
                    );
                }
            }
        }

        // Increment API call counter after successful response
        $response = $next($request);
        $this->tracker->incrementApiCalls($tenantId);

        return $response;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private function matchesPatterns(Request $request, array $patterns): bool
    {
        $path = '/' . ltrim($request->path(), '/');
        foreach ($patterns as $pattern) {
            if (str_contains($path, $pattern)) {
                return true;
            }
        }
        return false;
    }

    private function deny(string $type, string $title, string $detail, int|float $current, int $limit): Response
    {
        return response()->json([
            'type'       => "https://platform.local/errors/quota-exceeded",
            'title'      => $title,
            'status'     => 429,
            'detail'     => $detail,
            'quota_type' => $type,
            'current'    => $current,
            'limit'      => $limit,
        ], 429);
    }
}

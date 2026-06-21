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
 * Tracks API call usage and rejects requests when a tenant has exceeded
 * their monthly quota.
 *
 * Middleware alias: check_quota
 */
class CheckQuota
{
    public function __construct(
        private readonly UsageTracker  $tracker,
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
        $limit    = $features['api_calls_month'] ?? 'unlimited';

        if ($limit !== 'unlimited') {
            $current = $this->tracker->getApiCallsThisMonth($tenantId);
            if ($current >= (int) $limit) {
                return response()->json([
                    'type'    => 'https://platform.local/errors/quota-exceeded',
                    'title'   => 'Monthly API Quota Exceeded',
                    'status'  => 429,
                    'detail'  => "Your plan allows {$limit} API calls per month. Upgrade to increase your limit.",
                    'current' => $current,
                    'limit'   => (int) $limit,
                ], 429);
            }
        }

        // Increment counter after the request succeeds
        $response = $next($request);
        $this->tracker->incrementApiCalls($tenantId);

        return $response;
    }
}

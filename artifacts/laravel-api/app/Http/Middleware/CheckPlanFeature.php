<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Services\BillingService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware alias: plan_feature:feature_name[,required_value]
 *
 * Examples:
 *   plan_feature:ai_features          — check boolean feature is truthy
 *   plan_feature:max_users,10         — check limit >= requested value
 */
class CheckPlanFeature
{
    public function __construct(private readonly BillingService $billing) {}

    public function handle(Request $request, Closure $next, string $feature, ?string $requiredValue = null): Response
    {
        $tenantId = $request->attributes->get('active_tenant_id');

        if (! $tenantId || $tenantId === 'central') {
            return $next($request);
        }

        $tenant = Tenant::find($tenantId);
        if (! $tenant) {
            return $this->deny($feature);
        }

        $features = $this->billing->getPlanFeatures($tenant);
        $value    = $features[$feature] ?? null;

        if ($value === null) {
            return $this->deny($feature);
        }

        if ($requiredValue !== null) {
            // Numeric limit check: 'unlimited' always passes; otherwise value must be >= required
            if ($value !== 'unlimited' && (int) $value < (int) $requiredValue) {
                return $this->deny($feature, $value);
            }
        } else {
            // Boolean feature check
            if (! filter_var($value, FILTER_VALIDATE_BOOLEAN)) {
                return $this->deny($feature, $value);
            }
        }

        return $next($request);
    }

    private function deny(string $feature, ?string $currentValue = null): Response
    {
        $upgradePlan = $this->upgradeSuggestion($feature);

        return response()->json([
            'type'    => 'https://platform.local/errors/plan-limit',
            'title'   => 'Plan Limit Reached',
            'status'  => 402,
            'detail'  => "Your current plan does not include '{$feature}'. Upgrade to {$upgradePlan} to unlock this feature.",
            'feature' => $feature,
            'upgrade_to' => $upgradePlan,
        ], 402);
    }

    private function upgradeSuggestion(string $feature): string
    {
        return match (true) {
            in_array($feature, ['ai_features', 'custom_domain', 'sla'], true) => 'Professional',
            default                                                             => 'Professional or Enterprise',
        };
    }
}

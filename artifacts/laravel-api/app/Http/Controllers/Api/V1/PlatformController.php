<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class PlatformController extends Controller
{
    /**
     * GET /api/v1/platform/plans
     *
     * Public endpoint — returns all active plans in the PlanListResponse shape
     * expected by the generated TypeScript API client:
     *   { data: [{ key, name, price_monthly, stripe_price_id, features: string[], is_active }] }
     */
    public function plans(): JsonResponse
    {
        $plans = \App\Models\SubscriptionPlan::where('is_active', true)
            ->orderBy('sort_order')
            ->with('features')
            ->get()
            ->map(fn (\App\Models\SubscriptionPlan $plan) => [
                'key'             => $plan->key,
                'name'            => $plan->name,
                'price_monthly'   => $plan->price_cents / 100,
                'stripe_price_id' => $plan->stripe_price_id,
                'features'        => $this->featureLines($plan),
                'is_active'       => $plan->is_active,
            ])
            ->values();

        return response()->json(['data' => $plans]);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Convert a plan's feature_key → feature_value map into a human-readable
     * string array for display in the pricing card.
     */
    private function featureLines(\App\Models\SubscriptionPlan $plan): array
    {
        $map  = $plan->features_map;
        $lines = [];

        $users   = $map['max_users']        ?? null;
        $storage = $map['max_storage_gb']   ?? null;
        $api     = $map['api_calls_month']  ?? null;
        $ai      = $map['ai_features']      ?? '0';
        $domain  = $map['custom_domain']    ?? '0';
        $support = $map['priority_support'] ?? '0';

        // Handle 'unlimited' string values from DB
        $isUnlimited = fn ($v) => $v === null || $v === 'unlimited';

        $lines[] = $isUnlimited($users)
            ? 'Unlimited users'
            : ($users === '1' ? '1 user' : "Up to {$users} users");

        $lines[] = $isUnlimited($storage)
            ? 'Unlimited storage'
            : "{$storage} GB storage";

        if ($api !== null) {
            $lines[] = $isUnlimited($api)
                ? 'Unlimited API calls'
                : number_format((int) $api) . ' API calls/month';
        }

        if (filter_var($ai, FILTER_VALIDATE_BOOLEAN)) {
            $lines[] = 'AI features included';
        }
        if (filter_var($domain, FILTER_VALIDATE_BOOLEAN)) {
            $lines[] = 'Custom domain';
        }
        if (filter_var($support, FILTER_VALIDATE_BOOLEAN)) {
            $lines[] = 'Priority support';
        }
        if (!empty($map['sla'])) {
            $lines[] = 'Uptime SLA';
        }
        if (!empty($map['dedicated_instance'])) {
            $lines[] = 'Dedicated instance';
        }

        return $lines;
    }

    // ── Legacy static array (kept for reference, no longer served) ────────────
    private function _legacyPlans(): array
    {
        $plans = [
            [
                'id'          => 'free',
                'name'        => 'Free',
                'price'       => 0,
                'interval'    => null,
                'description' => 'Get started for free',
                'features'    => [
                    'max_users'         => 3,
                    'max_storage_gb'    => 1,
                    'api_calls_month'   => 1000,
                    'modules'           => ['crm', 'tasks'],
                    'ai_features'       => false,
                    'custom_domain'     => false,
                    'priority_support'  => false,
                ],
            ],
            [
                'id'          => 'trial',
                'name'        => 'Trial',
                'price'       => 0,
                'interval'    => null,
                'description' => '14-day full-featured trial',
                'features'    => [
                    'max_users'         => 10,
                    'max_storage_gb'    => 5,
                    'api_calls_month'   => 10000,
                    'modules'           => ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects'],
                    'ai_features'       => true,
                    'custom_domain'     => false,
                    'priority_support'  => false,
                ],
            ],
            [
                'id'          => 'professional_monthly',
                'name'        => 'Professional',
                'price'       => 4900,
                'interval'    => 'month',
                'description' => 'For growing businesses',
                'features'    => [
                    'max_users'         => 25,
                    'max_storage_gb'    => 50,
                    'api_calls_month'   => 100000,
                    'modules'           => ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects', 'pos', 'warehouse'],
                    'ai_features'       => true,
                    'custom_domain'     => true,
                    'priority_support'  => false,
                ],
            ],
            [
                'id'          => 'professional_yearly',
                'name'        => 'Professional (Annual)',
                'price'       => 49000,
                'interval'    => 'year',
                'description' => 'Best value — 2 months free',
                'features'    => [
                    'max_users'         => 25,
                    'max_storage_gb'    => 50,
                    'api_calls_month'   => 100000,
                    'modules'           => ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects', 'pos', 'warehouse'],
                    'ai_features'       => true,
                    'custom_domain'     => true,
                    'priority_support'  => true,
                ],
            ],
            [
                'id'          => 'enterprise',
                'name'        => 'Enterprise',
                'price'       => null,
                'interval'    => 'custom',
                'description' => 'Unlimited scale, dedicated support',
                'features'    => [
                    'max_users'         => null,
                    'max_storage_gb'    => null,
                    'api_calls_month'   => null,
                    'modules'           => ['all'],
                    'ai_features'       => true,
                    'custom_domain'     => true,
                    'priority_support'  => true,
                    'sla'               => true,
                    'dedicated_instance'=> true,
                ],
            ],
        ];

        return response()->json(['data' => $plans]);
    }
}

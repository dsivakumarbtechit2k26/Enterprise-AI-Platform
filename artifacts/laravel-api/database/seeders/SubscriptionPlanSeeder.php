<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\PlanFeature;
use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

/**
 * Seeds the canonical subscription plan catalogue.
 *
 * Plans:
 *   free           — 0 $/month  — 3 users, 1 GB, 1 000 API calls/mo
 *   professional   — 49 $/month — 25 users, 50 GB, 50 000 API calls/mo, AI, custom domain
 *   enterprise     — 199 $/month — unlimited users/storage/API, AI, custom domain, SLA, white-label
 *
 * Features are upserted so re-running is idempotent.
 * stripe_price_id is left null — run `php artisan billing:create-stripe-plans` to populate it.
 *
 * Feature types:
 *   limit   — numeric ceiling  (or 'unlimited')
 *   boolean — '1' = enabled, '0' = disabled
 */
class SubscriptionPlanSeeder extends Seeder
{
    private const PLANS = [
        [
            'key'         => 'free',
            'name'        => 'Free',
            'description' => 'Perfect for small teams getting started',
            'price_cents' => 0,
            'interval'    => null,
            'sort_order'  => 0,
            'is_active'   => true,
            'features'    => [
                ['key' => 'max_users',        'value' => '3',          'type' => 'limit'],
                ['key' => 'max_storage_gb',   'value' => '1',          'type' => 'limit'],
                ['key' => 'api_calls_month',  'value' => '1000',       'type' => 'limit'],
                ['key' => 'ai_features',      'value' => '0',          'type' => 'boolean'],
                ['key' => 'custom_domain',    'value' => '0',          'type' => 'boolean'],
                ['key' => 'white_label',      'value' => '0',          'type' => 'boolean'],
                ['key' => 'sla',              'value' => '0',          'type' => 'boolean'],
                ['key' => 'priority_support', 'value' => '0',          'type' => 'boolean'],
                ['key' => 'audit_log_days',   'value' => '30',         'type' => 'limit'],
            ],
        ],
        [
            'key'         => 'professional',
            'name'        => 'Professional',
            'description' => 'For growing teams that need more power',
            'price_cents' => 4900,
            'interval'    => 'month',
            'sort_order'  => 1,
            'is_active'   => true,
            'features'    => [
                ['key' => 'max_users',        'value' => '25',         'type' => 'limit'],
                ['key' => 'max_storage_gb',   'value' => '50',         'type' => 'limit'],
                ['key' => 'api_calls_month',  'value' => '50000',      'type' => 'limit'],
                ['key' => 'ai_features',      'value' => '1',          'type' => 'boolean'],
                ['key' => 'custom_domain',    'value' => '1',          'type' => 'boolean'],
                ['key' => 'white_label',      'value' => '0',          'type' => 'boolean'],
                ['key' => 'sla',              'value' => '0',          'type' => 'boolean'],
                ['key' => 'priority_support', 'value' => '1',          'type' => 'boolean'],
                ['key' => 'audit_log_days',   'value' => '180',        'type' => 'limit'],
            ],
        ],
        [
            'key'         => 'enterprise',
            'name'        => 'Enterprise',
            'description' => 'Unlimited scale, dedicated support, full control',
            'price_cents' => 19900,
            'interval'    => 'month',
            'sort_order'  => 2,
            'is_active'   => true,
            'features'    => [
                ['key' => 'max_users',        'value' => 'unlimited',  'type' => 'limit'],
                ['key' => 'max_storage_gb',   'value' => 'unlimited',  'type' => 'limit'],
                ['key' => 'api_calls_month',  'value' => 'unlimited',  'type' => 'limit'],
                ['key' => 'ai_features',      'value' => '1',          'type' => 'boolean'],
                ['key' => 'custom_domain',    'value' => '1',          'type' => 'boolean'],
                ['key' => 'white_label',      'value' => '1',          'type' => 'boolean'],
                ['key' => 'sla',              'value' => '1',          'type' => 'boolean'],
                ['key' => 'priority_support', 'value' => '1',          'type' => 'boolean'],
                ['key' => 'audit_log_days',   'value' => 'unlimited',  'type' => 'limit'],
            ],
        ],
    ];

    public function run(): void
    {
        foreach (self::PLANS as $planData) {
            $features = $planData['features'];
            unset($planData['features']);

            $plan = SubscriptionPlan::updateOrCreate(
                ['key' => $planData['key']],
                $planData,
            );

            foreach ($features as $feature) {
                PlanFeature::updateOrCreate(
                    [
                        'subscription_plan_id' => $plan->id,
                        'feature_key'          => $feature['key'],
                    ],
                    [
                        'feature_value' => $feature['value'],
                        'feature_type'  => $feature['type'],
                    ],
                );
            }

            $this->command->info("✓ Plan seeded: {$plan->key} ({$plan->name})");
        }
    }
}

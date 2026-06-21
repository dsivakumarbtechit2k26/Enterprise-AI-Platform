<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PlatformSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedSubscriptionPlans();
        $this->seedPlatformSettings();
    }

    private function seedSubscriptionPlans(): void
    {
        $plans = [
            ['key' => 'free',                   'name' => 'Free',                  'price_cents' => 0,     'interval' => null,    'sort_order' => 1],
            ['key' => 'trial',                  'name' => 'Trial',                 'price_cents' => 0,     'interval' => null,    'sort_order' => 2],
            ['key' => 'professional_monthly',   'name' => 'Professional Monthly',  'price_cents' => 4900,  'interval' => 'month', 'sort_order' => 3],
            ['key' => 'professional_yearly',    'name' => 'Professional Yearly',   'price_cents' => 49000, 'interval' => 'year',  'sort_order' => 4],
            ['key' => 'enterprise',             'name' => 'Enterprise',            'price_cents' => 0,     'interval' => 'custom','sort_order' => 5],
        ];

        foreach ($plans as $plan) {
            DB::connection('central')->table('subscription_plans')->updateOrInsert(
                ['key' => $plan['key']],
                array_merge($plan, ['is_active' => true, 'created_at' => now(), 'updated_at' => now()])
            );
        }

        // Seed plan features
        $freePlan = DB::connection('central')->table('subscription_plans')->where('key', 'free')->first();
        $trialPlan = DB::connection('central')->table('subscription_plans')->where('key', 'trial')->first();
        $proMonthly = DB::connection('central')->table('subscription_plans')->where('key', 'professional_monthly')->first();
        $proYearly = DB::connection('central')->table('subscription_plans')->where('key', 'professional_yearly')->first();
        $enterprise = DB::connection('central')->table('subscription_plans')->where('key', 'enterprise')->first();

        $features = [
            $freePlan->id => [
                ['feature_key' => 'max_users', 'feature_value' => '3', 'feature_type' => 'limit'],
                ['feature_key' => 'max_storage_gb', 'feature_value' => '1', 'feature_type' => 'limit'],
                ['feature_key' => 'api_calls_month', 'feature_value' => '1000', 'feature_type' => 'limit'],
                ['feature_key' => 'ai_features', 'feature_value' => '0', 'feature_type' => 'boolean'],
                ['feature_key' => 'custom_domain', 'feature_value' => '0', 'feature_type' => 'boolean'],
            ],
            $trialPlan->id => [
                ['feature_key' => 'max_users', 'feature_value' => '10', 'feature_type' => 'limit'],
                ['feature_key' => 'max_storage_gb', 'feature_value' => '5', 'feature_type' => 'limit'],
                ['feature_key' => 'api_calls_month', 'feature_value' => '10000', 'feature_type' => 'limit'],
                ['feature_key' => 'ai_features', 'feature_value' => '1', 'feature_type' => 'boolean'],
                ['feature_key' => 'custom_domain', 'feature_value' => '0', 'feature_type' => 'boolean'],
            ],
            $proMonthly->id => [
                ['feature_key' => 'max_users', 'feature_value' => '25', 'feature_type' => 'limit'],
                ['feature_key' => 'max_storage_gb', 'feature_value' => '50', 'feature_type' => 'limit'],
                ['feature_key' => 'api_calls_month', 'feature_value' => '100000', 'feature_type' => 'limit'],
                ['feature_key' => 'ai_features', 'feature_value' => '1', 'feature_type' => 'boolean'],
                ['feature_key' => 'custom_domain', 'feature_value' => '1', 'feature_type' => 'boolean'],
            ],
            $proYearly->id => [
                ['feature_key' => 'max_users', 'feature_value' => '25', 'feature_type' => 'limit'],
                ['feature_key' => 'max_storage_gb', 'feature_value' => '50', 'feature_type' => 'limit'],
                ['feature_key' => 'api_calls_month', 'feature_value' => '100000', 'feature_type' => 'limit'],
                ['feature_key' => 'ai_features', 'feature_value' => '1', 'feature_type' => 'boolean'],
                ['feature_key' => 'custom_domain', 'feature_value' => '1', 'feature_type' => 'boolean'],
            ],
            $enterprise->id => [
                ['feature_key' => 'max_users', 'feature_value' => 'unlimited', 'feature_type' => 'limit'],
                ['feature_key' => 'max_storage_gb', 'feature_value' => 'unlimited', 'feature_type' => 'limit'],
                ['feature_key' => 'api_calls_month', 'feature_value' => 'unlimited', 'feature_type' => 'limit'],
                ['feature_key' => 'ai_features', 'feature_value' => '1', 'feature_type' => 'boolean'],
                ['feature_key' => 'custom_domain', 'feature_value' => '1', 'feature_type' => 'boolean'],
                ['feature_key' => 'sla', 'feature_value' => '1', 'feature_type' => 'boolean'],
            ],
        ];

        foreach ($features as $planId => $planFeatures) {
            foreach ($planFeatures as $feature) {
                DB::connection('central')->table('plan_features')->updateOrInsert(
                    ['subscription_plan_id' => $planId, 'feature_key' => $feature['feature_key']],
                    array_merge($feature, ['subscription_plan_id' => $planId, 'created_at' => now(), 'updated_at' => now()])
                );
            }
        }
    }

    private function seedPlatformSettings(): void
    {
        $settings = [
            ['key' => 'platform_name',          'value' => 'Enterprise Platform', 'type' => 'string',  'group' => 'general',  'is_public' => true],
            ['key' => 'allow_registration',     'value' => '1',                   'type' => 'boolean', 'group' => 'auth',     'is_public' => true],
            ['key' => 'allow_google_oauth',     'value' => '0',                   'type' => 'boolean', 'group' => 'auth',     'is_public' => true],
            ['key' => 'allow_github_oauth',     'value' => '0',                   'type' => 'boolean', 'group' => 'auth',     'is_public' => true],
            ['key' => 'maintenance_mode',       'value' => '0',                   'type' => 'boolean', 'group' => 'general',  'is_public' => true],
            ['key' => 'trial_days',             'value' => '14',                  'type' => 'integer', 'group' => 'billing',  'is_public' => true],
        ];

        foreach ($settings as $setting) {
            DB::connection('central')->table('platform_settings')->updateOrInsert(
                ['key' => $setting['key']],
                array_merge($setting, ['created_at' => now(), 'updated_at' => now()])
            );
        }
    }
}

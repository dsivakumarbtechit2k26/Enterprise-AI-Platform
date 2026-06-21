<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\SubscriptionPlan;
use App\Models\Tenant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Exceptions\IncompletePayment;
use Stripe\Exception\ApiErrorException;

class BillingService
{
    private const PLAN_CACHE_TTL = 300; // 5 minutes

    // ── Customer management ───────────────────────────────────────────────────

    /**
     * Create or retrieve a Stripe customer for the tenant.
     */
    public function ensureStripeCustomer(Tenant $tenant): void
    {
        if ($tenant->stripe_id) {
            return;
        }

        try {
            $tenant->createAsStripeCustomer([
                'name'     => $tenant->name,
                'metadata' => ['tenant_id' => $tenant->id],
            ]);
        } catch (\Throwable $e) {
            Log::warning('BillingService: could not create Stripe customer', [
                'tenant_id' => $tenant->id,
                'error'     => $e->getMessage(),
            ]);
        }
    }

    // ── Free plan setup ───────────────────────────────────────────────────────

    public function assignFreePlan(Tenant $tenant): void
    {
        $tenant->update(['plan' => 'free']);
        $this->bustPlanCache($tenant->id);
    }

    // ── Plan feature resolution ───────────────────────────────────────────────

    /**
     * Returns an array of feature_key => feature_value for the tenant's current plan.
     * Cached in Redis/file cache for 5 minutes.
     */
    public function getPlanFeatures(Tenant $tenant): array
    {
        $cacheKey = "tenant_plan_features:{$tenant->id}";

        return Cache::remember($cacheKey, self::PLAN_CACHE_TTL, function () use ($tenant) {
            $planKey = $tenant->plan ?? 'free';
            $plan = SubscriptionPlan::where('key', $planKey)
                ->with('features')
                ->first();

            if (! $plan) {
                return $this->defaultFreePlanFeatures();
            }

            return $plan->features_map;
        });
    }

    public function bustPlanCache(string $tenantId): void
    {
        Cache::forget("tenant_plan_features:{$tenantId}");
    }

    // ── Checkout session ──────────────────────────────────────────────────────

    /**
     * Create a Stripe Checkout Session for upgrading to a paid plan.
     *
     * Embeds tenant_id and plan_key in both the session metadata and the
     * subscription_data metadata so that every downstream webhook (checkout.session
     * .completed, customer.subscription.created, customer.subscription.updated) can
     * activate the plan reliably without depending on event ordering.
     *
     * @throws \RuntimeException if Stripe is not configured
     */
    public function createCheckoutSession(
        Tenant $tenant,
        string $priceId,
        string $planKey,
        string $successUrl,
        string $cancelUrl,
    ): string {
        $this->ensureStripeCustomer($tenant);

        $meta = [
            'tenant_id' => $tenant->id,
            'plan_key'  => $planKey,
        ];

        $checkout = $tenant->newSubscription('default', $priceId)
            ->checkout([
                'success_url'       => $successUrl . '?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url'        => $cancelUrl,
                'metadata'          => $meta,
                'subscription_data' => ['metadata' => $meta],
            ]);

        return $checkout->url;
    }

    // ── Billing portal ────────────────────────────────────────────────────────

    public function createPortalSession(Tenant $tenant, string $returnUrl): string
    {
        $this->ensureStripeCustomer($tenant);

        return $tenant->billingPortalUrl($returnUrl);
    }

    // ── Current subscription ──────────────────────────────────────────────────

    public function currentSubscriptionStatus(Tenant $tenant): array
    {
        $plan = SubscriptionPlan::where('key', $tenant->plan ?? 'free')
            ->with('features')
            ->first();

        $sub = $tenant->subscriptions()->latest()->first();

        return [
            'plan'             => $tenant->plan ?? 'free',
            'plan_name'        => $plan?->name ?? 'Free',
            'stripe_status'    => $sub?->stripe_status,
            'current_period_end' => $sub ? $sub->ends_at?->toIso8601String() : null,
            'on_grace_period'  => $sub ? $sub->onGracePeriod() : false,
            'trial_ends_at'    => $tenant->trial_ends_at?->toIso8601String(),
            'features'         => $plan?->features_map ?? $this->defaultFreePlanFeatures(),
        ];
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private function defaultFreePlanFeatures(): array
    {
        return [
            'max_users'        => '3',
            'max_storage_gb'   => '1',
            'api_calls_month'  => '1000',
            'ai_features'      => '0',
            'custom_domain'    => '0',
        ];
    }
}

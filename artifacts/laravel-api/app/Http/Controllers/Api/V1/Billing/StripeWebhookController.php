<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Billing;

use App\Jobs\SendDunningEmailJob;
use App\Models\Tenant;
use App\Services\BillingService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Http\Controllers\WebhookController;
use Symfony\Component\HttpFoundation\Response;

class StripeWebhookController extends WebhookController
{
    public function __construct(private readonly BillingService $billing)
    {
        parent::__construct(); // Registers VerifyWebhookSignature when STRIPE_WEBHOOK_SECRET is set
    }

    // ── checkout.session.completed ────────────────────────────────────────────

    public function handleCheckoutSessionCompleted(array $payload): Response
    {
        $session = $payload['data']['object'];
        $tenantId = $session['metadata']['tenant_id'] ?? null;

        if (! $tenantId) {
            return $this->successMethod();
        }

        $tenant = Tenant::find($tenantId);
        if (! $tenant) {
            return $this->successMethod();
        }

        // Map Stripe price → plan key (best effort; definitive update via subscription.updated)
        if ($priceId = $session['metadata']['plan_key'] ?? null) {
            $tenant->update(['plan' => $priceId]);
            $this->billing->bustPlanCache($tenant->id);
        }

        Log::info('Stripe: checkout.session.completed', ['tenant_id' => $tenantId]);

        return $this->successMethod();
    }

    // ── invoice.paid ──────────────────────────────────────────────────────────

    public function handleInvoicePaid(array $payload): Response
    {
        $invoice  = $payload['data']['object'];
        $stripeId = $invoice['customer'];
        $tenant   = Tenant::where('stripe_id', $stripeId)->first();

        if ($tenant) {
            $tenant->update(['status' => 'active']);
            $this->billing->bustPlanCache($tenant->id);
            Log::info('Stripe: invoice.paid', ['tenant_id' => $tenant->id]);
        }

        return $this->successMethod();
    }

    // ── invoice.payment_failed ────────────────────────────────────────────────

    public function handleInvoicePaymentFailed(array $payload): Response
    {
        $invoice  = $payload['data']['object'];
        $stripeId = $invoice['customer'];
        $tenant   = Tenant::where('stripe_id', $stripeId)->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        $attemptCount = $invoice['attempt_count'] ?? 1;

        // Schedule dunning emails on day 1, 3, 7 based on attempt number
        $delays = [1 => 0, 2 => now()->addDays(2), 3 => now()->addDays(6)];
        $delay = $delays[$attemptCount] ?? null;

        if ($delay !== null) {
            $job = new SendDunningEmailJob($tenant->id, $attemptCount);
            $delay === 0 ? dispatch($job) : dispatch($job)->delay($delay);
        }

        Log::warning('Stripe: invoice.payment_failed', [
            'tenant_id' => $tenant->id,
            'attempt'   => $attemptCount,
        ]);

        return $this->successMethod();
    }

    // ── customer.subscription.updated ────────────────────────────────────────

    public function handleCustomerSubscriptionUpdated(array $payload): Response
    {
        $sub      = $payload['data']['object'];
        $stripeId = $sub['customer'];
        $tenant   = Tenant::where('stripe_id', $stripeId)->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        // Resolve plan key from price metadata
        $priceId  = $sub['items']['data'][0]['price']['id'] ?? null;
        $planKey  = $sub['metadata']['plan_key'] ?? $this->planKeyFromPriceId($priceId);

        if ($planKey) {
            $tenant->update(['plan' => $planKey]);
            $this->billing->bustPlanCache($tenant->id);
        }

        Log::info('Stripe: customer.subscription.updated', [
            'tenant_id' => $tenant->id,
            'plan'      => $planKey,
        ]);

        return $this->successMethod();
    }

    // ── customer.subscription.deleted ────────────────────────────────────────

    public function handleCustomerSubscriptionDeleted(array $payload): Response
    {
        $sub      = $payload['data']['object'];
        $stripeId = $sub['customer'];
        $tenant   = Tenant::where('stripe_id', $stripeId)->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        $tenant->update([
            'plan'                 => 'free',
            'subscription_ends_at' => now(),
        ]);
        $this->billing->bustPlanCache($tenant->id);

        Log::info('Stripe: customer.subscription.deleted — downgraded to free', [
            'tenant_id' => $tenant->id,
        ]);

        return $this->successMethod();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function planKeyFromPriceId(?string $priceId): ?string
    {
        if (! $priceId) {
            return null;
        }

        return \App\Models\SubscriptionPlan::where('stripe_price_id', $priceId)
            ->value('key');
    }
}

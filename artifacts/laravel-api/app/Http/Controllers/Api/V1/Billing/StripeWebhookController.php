<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Billing;

use App\Jobs\SendDunningEmailJob;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Services\BillingService;
use App\Services\SecurityAlertService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Http\Controllers\WebhookController;
use Symfony\Component\HttpFoundation\Response;

class StripeWebhookController extends WebhookController
{
    public function __construct(
        private readonly BillingService       $billing,
        private readonly SecurityAlertService $securityAlert,
    ) {
        parent::__construct(); // Registers VerifyWebhookSignature when STRIPE_WEBHOOK_SECRET is set
    }

    // ── checkout.session.completed ────────────────────────────────────────────
    //
    // Sets the plan immediately on payment success. Resolves tenant from
    // metadata.tenant_id (set by BillingService) with a customer-ID fallback
    // so that plan activation succeeds even if metadata was partially missing.
    // customer.subscription.created fires shortly after and will also sync.

    public function handleCheckoutSessionCompleted(array $payload): Response
    {
        $session  = $payload['data']['object'];

        // Resolve tenant — prefer explicit metadata, fall back to customer ID
        $tenantId = $session['metadata']['tenant_id'] ?? null;
        $tenant   = $tenantId
            ? Tenant::find($tenantId)
            : Tenant::where('stripe_id', $session['customer'] ?? '')->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        $planKey = $session['metadata']['plan_key'] ?? null;

        if ($planKey) {
            $tenant->update(['plan' => $planKey, 'subscription_ends_at' => null]);
            $this->billing->bustPlanCache($tenant->id);
        }

        AuditLog::record(
            event:     'billing.checkout.completed',
            newValues: ['plan' => $planKey, 'stripe_session' => $session['id'] ?? null],
            tenantId:  $tenant->id,
        );

        Log::info('Stripe: checkout.session.completed', [
            'tenant_id' => $tenant->id,
            'plan'      => $planKey,
        ]);

        return $this->successMethod();
    }

    // ── customer.subscription.created ────────────────────────────────────────
    //
    // Provides deterministic plan activation on initial subscription creation.
    // Fires before customer.subscription.updated, so the plan is set as early
    // as possible regardless of event ordering or metadata availability.
    // Resolves plan key from metadata (set by checkout) with price-ID fallback.

    public function handleCustomerSubscriptionCreated(array $payload): Response
    {
        // Let Cashier record the subscription row first
        parent::handleCustomerSubscriptionCreated($payload);

        $sub      = $payload['data']['object'];
        $stripeId = $sub['customer'];
        $tenant   = Tenant::where('stripe_id', $stripeId)->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        $priceId = $sub['items']['data'][0]['price']['id'] ?? null;
        $planKey = $sub['metadata']['plan_key'] ?? $this->planKeyFromPriceId($priceId);

        if ($planKey) {
            $tenant->update([
                'plan'                 => $planKey,
                'subscription_ends_at' => null,
            ]);
            $this->billing->bustPlanCache($tenant->id);
        }

        AuditLog::record(
            event:     'billing.subscription.created',
            newValues: ['plan' => $planKey, 'stripe_subscription' => $sub['id'] ?? null],
            tenantId:  $tenant->id,
        );

        Log::info('Stripe: customer.subscription.created', [
            'tenant_id' => $tenant->id,
            'plan'      => $planKey,
        ]);

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

            AuditLog::record(
                event:     'billing.invoice.paid',
                newValues: ['stripe_invoice' => $invoice['id'] ?? null, 'amount' => $invoice['amount_paid'] ?? null],
                tenantId:  $tenant->id,
            );

            Log::info('Stripe: invoice.paid', ['tenant_id' => $tenant->id]);
        }

        return $this->successMethod();
    }

    // ── invoice.payment_failed ────────────────────────────────────────────────
    //
    // Guarantees day 1/3/7 dunning cadence by scheduling all three emails
    // on the FIRST payment failure, not tied to Stripe retry timing.
    // Stripe may retry on any schedule; we schedule all jobs upfront so
    // the cadence is fixed relative to the first failure event.
    // Subsequent attempt_count > 1 events are logged but no extra emails queued.

    public function handleInvoicePaymentFailed(array $payload): Response
    {
        $invoice  = $payload['data']['object'];
        $stripeId = $invoice['customer'];
        $tenant   = Tenant::where('stripe_id', $stripeId)->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        $attemptCount = $invoice['attempt_count'] ?? 1;

        // Schedule all three dunning emails on first failure only.
        // This ensures fixed day 1/3/7 cadence independent of Stripe retry timing.
        if ($attemptCount === 1) {
            dispatch(new SendDunningEmailJob($tenant->id, 1));                           // day 1 — immediate
            dispatch(new SendDunningEmailJob($tenant->id, 2))->delay(now()->addDays(3)); // day 3
            dispatch(new SendDunningEmailJob($tenant->id, 3))->delay(now()->addDays(7)); // day 7
        }

        $this->securityAlert->alertPaymentFailed($tenant, $invoice['id'] ?? '', $attemptCount);

        AuditLog::record(
            event:     'billing.invoice.payment_failed',
            newValues: [
                'stripe_invoice' => $invoice['id'] ?? null,
                'attempt_count'  => $attemptCount,
                'dunning_queued' => $attemptCount === 1,
            ],
            tenantId:  $tenant->id,
        );

        Log::warning('Stripe: invoice.payment_failed', [
            'tenant_id' => $tenant->id,
            'attempt'   => $attemptCount,
            'dunning_scheduled' => $attemptCount === 1,
        ]);

        return $this->successMethod();
    }

    // ── customer.subscription.updated ────────────────────────────────────────
    //
    // Delegates to Cashier parent FIRST so that the `subscriptions` table row
    // (stripe_status, ends_at, items, trial_ends_at) is always kept in sync by
    // Cashier's own logic. Our additional logic runs after.

    public function handleCustomerSubscriptionUpdated(array $payload): Response
    {
        // Sync Cashier's own subscriptions table (stripe_status, ends_at, items, etc.)
        parent::handleCustomerSubscriptionUpdated($payload);

        $sub      = $payload['data']['object'];
        $stripeId = $sub['customer'];
        $tenant   = Tenant::where('stripe_id', $stripeId)->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        // If the subscription is set to cancel at period end, preserve the current
        // plan and record when it will expire — the tenant retains paid access until then.
        if ($sub['cancel_at_period_end'] ?? false) {
            $periodEnd = isset($sub['current_period_end'])
                ? Carbon::createFromTimestamp($sub['current_period_end'])
                : null;

            $tenant->update(['subscription_ends_at' => $periodEnd]);
            $this->billing->bustPlanCache($tenant->id);

            AuditLog::record(
                event:     'billing.subscription.cancellation_scheduled',
                newValues: ['ends_at' => $periodEnd?->toIso8601String(), 'stripe_subscription' => $sub['id'] ?? null],
                tenantId:  $tenant->id,
            );

            Log::info('Stripe: subscription set to cancel at period end', [
                'tenant_id' => $tenant->id,
                'ends_at'   => $periodEnd?->toIso8601String(),
            ]);

            return $this->successMethod();
        }

        // Normal update / upgrade / reactivation — sync plan key
        $priceId = $sub['items']['data'][0]['price']['id'] ?? null;
        $planKey = $sub['metadata']['plan_key'] ?? $this->planKeyFromPriceId($priceId);

        if ($planKey) {
            $tenant->update([
                'plan'                 => $planKey,
                'subscription_ends_at' => null, // clear any pending cancellation
            ]);
            $this->billing->bustPlanCache($tenant->id);
        }

        AuditLog::record(
            event:     'billing.subscription.updated',
            newValues: ['plan' => $planKey, 'stripe_subscription' => $sub['id'] ?? null],
            tenantId:  $tenant->id,
        );

        Log::info('Stripe: customer.subscription.updated', [
            'tenant_id' => $tenant->id,
            'plan'      => $planKey,
        ]);

        return $this->successMethod();
    }

    // ── customer.subscription.deleted ────────────────────────────────────────
    //
    // `customer.subscription.deleted` fires either when Stripe has reached
    // `current_period_end` (for cancel_at_period_end subs) or immediately on
    // immediate cancellations.  We only downgrade to free once the period has
    // truly ended; if `current_period_end` is in the future the tenant keeps
    // their plan until that date and we schedule a grace-period window.

    public function handleCustomerSubscriptionDeleted(array $payload): Response
    {
        // Sync Cashier's subscriptions table — marks subscription as canceled
        parent::handleCustomerSubscriptionDeleted($payload);

        $sub      = $payload['data']['object'];
        $stripeId = $sub['customer'];
        $tenant   = Tenant::where('stripe_id', $stripeId)->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        $periodEnd = isset($sub['current_period_end'])
            ? Carbon::createFromTimestamp($sub['current_period_end'])
            : null;

        if ($periodEnd && $periodEnd->isFuture()) {
            // Immediately-cancelled subscription with remaining paid time (grace period)
            $tenant->update(['subscription_ends_at' => $periodEnd]);

            AuditLog::record(
                event:     'billing.subscription.cancelled',
                newValues: ['grace_period_ends' => $periodEnd->toIso8601String(), 'stripe_subscription' => $sub['id'] ?? null],
                tenantId:  $tenant->id,
            );

            Log::info('Stripe: subscription deleted with remaining grace period', [
                'tenant_id'  => $tenant->id,
                'grace_ends' => $periodEnd->toIso8601String(),
            ]);
        } else {
            // Subscription period has fully ended — downgrade to free
            $tenant->update([
                'plan'                 => 'free',
                'subscription_ends_at' => $periodEnd ?? now(),
            ]);

            AuditLog::record(
                event:     'billing.subscription.expired',
                newValues: ['plan' => 'free', 'stripe_subscription' => $sub['id'] ?? null],
                tenantId:  $tenant->id,
            );

            Log::info('Stripe: customer.subscription.deleted — downgraded to free', [
                'tenant_id' => $tenant->id,
            ]);
        }

        $this->billing->bustPlanCache($tenant->id);

        return $this->successMethod();
    }

    // ── payment_intent.payment_failed ────────────────────────────────────────
    //
    // Fires when a PaymentIntent permanently fails (distinct from
    // invoice.payment_failed, which covers subscription renewals).
    // Common sources: off-session payments, Setup Intent confirmations,
    // one-time charges. We log the failure and flag the tenant for follow-up.

    public function handlePaymentIntentPaymentFailed(array $payload): Response
    {
        $intent   = $payload['data']['object'];
        $stripeId = $intent['customer'] ?? null;

        if (! $stripeId) {
            return $this->successMethod();
        }

        $tenant = Tenant::where('stripe_id', $stripeId)->first();

        if (! $tenant) {
            return $this->successMethod();
        }

        $lastError = $intent['last_payment_error'] ?? [];

        AuditLog::record(
            event:     'billing.payment_intent.failed',
            newValues: [
                'payment_intent' => $intent['id'] ?? null,
                'error_code'     => $lastError['code'] ?? null,
                'amount'         => $intent['amount'] ?? null,
                'currency'       => $intent['currency'] ?? null,
            ],
            tenantId:  $tenant->id,
        );

        Log::warning('Stripe: payment_intent.payment_failed', [
            'tenant_id'       => $tenant->id,
            'payment_intent'  => $intent['id'],
            'error_code'      => $lastError['code'] ?? null,
            'error_message'   => $lastError['message'] ?? null,
            'amount'          => $intent['amount'] ?? null,
            'currency'        => $intent['currency'] ?? null,
        ]);

        $this->billing->bustPlanCache($tenant->id);

        return $this->successMethod();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function planKeyFromPriceId(?string $priceId): ?string
    {
        if (! $priceId) {
            return null;
        }

        return \App\Models\SubscriptionPlan::where('stripe_price_id', $priceId)->value('key');
    }
}

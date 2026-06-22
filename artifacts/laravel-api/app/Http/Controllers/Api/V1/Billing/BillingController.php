<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Billing;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SubscriptionPlan;
use App\Models\Tenant;
use App\Services\BillingService;
use App\Services\InvoiceService;
use App\Services\UsageTracker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class BillingController extends Controller
{
    public function __construct(
        private readonly BillingService $billing,
        private readonly InvoiceService $invoices,
        private readonly UsageTracker   $tracker,
    ) {}

    // ── GET /billing/subscription ─────────────────────────────────────────────
    //
    // Returns the SubscriptionResponse shape expected by the TypeScript client:
    //   { subscription: { plan_key, plan_name, status, current_period_end, quota } }

    public function subscription(Request $request): JsonResponse
    {
        $tenant  = $this->resolveTenant($request);
        $plan    = SubscriptionPlan::where('key', $tenant->plan ?? 'free')->with('features')->first();
        $sub     = $tenant->subscriptions()->latest()->first();
        $features = $this->billing->getPlanFeatures($tenant);

        $maxUsers   = $features['max_users']       ?? null;
        $maxStorage = $features['max_storage_gb']  ?? null;
        $maxApi     = $features['api_calls_month'] ?? null;

        $quota = [
            'api_calls_used'   => $this->tracker->getApiCallsThisMonth($tenant->id),
            'api_calls_limit'  => $maxApi === null || $maxApi === 'unlimited' ? null : (int) $maxApi,
            'users_count'      => $this->tracker->getActiveUserCount($tenant->id),
            'users_limit'      => $maxUsers === null || $maxUsers === 'unlimited' ? null : (int) $maxUsers,
            'storage_used_mb'  => (int) round($this->tracker->getStorageGb($tenant->id) * 1000),
            'storage_limit_mb' => $maxStorage === null || $maxStorage === 'unlimited'
                ? null
                : (int) ((float) $maxStorage * 1000),
        ];

        // Map Cashier stripe_status to SubscriptionStatus enum values
        $status = match ($sub?->stripe_status) {
            'trialing'                      => 'trialing',
            'past_due'                      => 'past_due',
            'canceled', 'cancelled'         => 'canceled',
            'incomplete', 'incomplete_expired' => 'incomplete',
            default                         => 'active',
        };

        return response()->json([
            'subscription' => [
                'plan_key'               => $tenant->plan ?? 'free',
                'plan_name'              => $plan?->name ?? 'Free',
                'status'                 => $status,
                'current_period_start'   => null,
                'current_period_end'     => $sub?->ends_at?->toIso8601String(),
                'cancel_at_period_end'   => $sub ? $sub->onGracePeriod() : false,
                'stripe_subscription_id' => $sub?->stripe_id ?? null,
                'quota'                  => $quota,
            ],
        ]);
    }

    // ── POST /billing/checkout ────────────────────────────────────────────────
    //
    // Accepts only { price_id }; success/cancel URLs are derived from config
    // so the client does not need to pass them.

    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'price_id' => ['required', 'string'],
        ]);

        $plan = SubscriptionPlan::where('stripe_price_id', $validated['price_id'])
            ->where('is_active', true)
            ->first();

        if (! $plan) {
            return response()->json([
                'message' => 'The selected price does not match any active subscription plan.',
            ], 422);
        }

        $tenant     = $this->resolveTenant($request);
        $frontendUrl = rtrim(config('app.frontend_url', config('app.url')), '/');
        $successUrl  = $frontendUrl . '/settings/billing?checkout=success';
        $cancelUrl   = $frontendUrl . '/settings/billing?checkout=cancelled';

        try {
            $url = $this->billing->createCheckoutSession(
                $tenant,
                $validated['price_id'],
                $plan->key,
                $successUrl,
                $cancelUrl,
            );

            AuditLog::record(
                event:     'billing.checkout.started',
                newValues: ['plan_key' => $plan->key, 'price_id' => $validated['price_id']],
                tenantId:  $tenant->id,
                actorId:   $request->user()?->id,
                ipAddress: $request->ip(),
            );

            return response()->json(['url' => $url]);
        } catch (\Throwable $e) {
            Log::error('BillingController@checkout failed', [
                'tenant_id' => $tenant->id,
                'error'     => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Billing service unavailable. Please try again later.',
                'error'   => app()->isLocal() ? $e->getMessage() : null,
            ], 503);
        }
    }

    // ── POST /billing/portal ──────────────────────────────────────────────────
    //
    // return_url is derived from config; no body required from the client.

    public function portal(Request $request): JsonResponse
    {
        $tenant      = $this->resolveTenant($request);
        $frontendUrl = rtrim(config('app.frontend_url', config('app.url')), '/');
        $returnUrl   = $frontendUrl . '/settings/billing';

        try {
            $url = $this->billing->createPortalSession($tenant, $returnUrl);

            return response()->json(['url' => $url]);
        } catch (\Throwable $e) {
            Log::error('BillingController@portal failed', [
                'tenant_id' => $tenant->id,
                'error'     => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Billing service unavailable. Please try again later.',
                'error'   => app()->isLocal() ? $e->getMessage() : null,
            ], 503);
        }
    }

    // ── GET /billing/invoices ─────────────────────────────────────────────────

    public function invoiceList(Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        try {
            $stripeInvoices = $tenant->invoices();

            $data = collect($stripeInvoices)->map(fn ($inv) => [
                'id'          => $inv->id,
                'amount_due'  => $inv->rawTotal(),
                'currency'    => strtoupper($inv->currency()),
                'status'      => $inv->status,
                'date'        => $inv->date()->toIso8601String(),
                'pdf_url'     => route('api.v1.billing.invoices.download', ['invoiceId' => $inv->id]),
            ]);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return response()->json(['data' => []]);
        }
    }

    // ── GET /billing/invoices/{id}/download ───────────────────────────────────
    // Generates a branded PDF, persists it to storage, and returns a signed
    // temporary URL (15 min) pointing to the serve endpoint. The client
    // follows the URL to download the actual PDF.

    public function downloadInvoice(Request $request, string $invoiceId): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        try {
            $url = $this->invoices->generateSignedUrl($tenant, $invoiceId);

            return response()->json([
                'url'        => $url,
                'expires_in' => 900,
            ]);
        } catch (\Throwable $e) {
            Log::warning('BillingController@downloadInvoice failed', [
                'tenant_id'  => $tenant->id,
                'invoice_id' => $invoiceId,
                'error'      => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Invoice not found.'], 404);
        }
    }

    // ── GET /billing/invoices/{tenantId}/{invoiceId}/serve ────────────────────
    // Serves the stored PDF. Protected by Laravel signed URL middleware —
    // no auth token required; the signed URL itself is the credential.

    public function serveInvoicePdf(Request $request, string $tenantId, string $invoiceId): Response
    {
        return $this->invoices->serveFromStorage($tenantId, $invoiceId);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private function resolveTenant(Request $request): Tenant
    {
        $tenantId = $request->attributes->get('active_tenant_id');

        /** @var Tenant $tenant */
        $tenant = Tenant::findOrFail($tenantId);

        return $tenant;
    }
}

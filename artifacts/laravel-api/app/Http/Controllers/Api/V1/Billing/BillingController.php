<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Billing;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\BillingService;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class BillingController extends Controller
{
    public function __construct(
        private readonly BillingService $billing,
        private readonly InvoiceService $invoices,
    ) {}

    // ── GET /billing/subscription ─────────────────────────────────────────────

    public function subscription(Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        return response()->json([
            'data' => $this->billing->currentSubscriptionStatus($tenant),
        ]);
    }

    // ── POST /billing/checkout ────────────────────────────────────────────────

    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'price_id'    => ['required', 'string'],
            'success_url' => ['required', 'url'],
            'cancel_url'  => ['required', 'url'],
        ]);

        $tenant = $this->resolveTenant($request);

        try {
            $url = $this->billing->createCheckoutSession(
                $tenant,
                $validated['price_id'],
                $validated['success_url'],
                $validated['cancel_url'],
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

    public function portal(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'return_url' => ['required', 'url'],
        ]);

        $tenant = $this->resolveTenant($request);

        try {
            $url = $this->billing->createPortalSession($tenant, $validated['return_url']);

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

    public function downloadInvoice(Request $request, string $invoiceId): Response|JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        try {
            return $tenant->downloadInvoice($invoiceId, [
                'vendor'  => config('app.name', 'Enterprise Platform'),
                'product' => 'SaaS Subscription',
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Invoice not found.'], 404);
        }
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

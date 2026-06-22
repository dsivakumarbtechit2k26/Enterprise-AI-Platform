<?php

declare(strict_types=1);

namespace Tests\Feature\AuditLog;

use App\Http\Controllers\Api\V1\Billing\StripeWebhookController;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Services\BillingService;
use App\Services\SecurityAlertService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

/**
 * Verifies that each Stripe webhook handler writes the correct AuditLog event.
 *
 * Controllers are resolved through the container so that mocked services are
 * injected automatically. Handlers are called directly (bypassing HTTP routing
 * and Stripe signature verification) because we are testing business logic,
 * not the webhook transport layer.
 *
 * Tenant rows are inserted via raw SQL to bypass stancl/tenancy's model
 * Observer that creates physical database schemas.
 */
class AuditWebhookTest extends TestCase
{
    private Tenant $tenant;
    private StripeWebhookController $controller;

    protected function setUp(): void
    {
        parent::setUp();

        // Insert the tenant row directly — bypasses tenancy schema creation Observer.
        DB::connection('central')->table('tenants')->insert([
            'id'         => 'wh-test-tenant',
            'name'       => 'Webhook Tenant',
            'slug'       => 'wh-test-tenant',
            'plan'       => 'free',
            'status'     => 'active',
            'stripe_id'  => 'cus_test_123',
            'data'       => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->tenant = Tenant::find('wh-test-tenant');

        // Stub BillingService::bustPlanCache so cache/Redis is not touched.
        $billing = Mockery::mock(BillingService::class);
        $billing->shouldReceive('bustPlanCache')->andReturnNull();
        $this->app->instance(BillingService::class, $billing);

        // Stub SecurityAlertService so no emails are dispatched.
        $security = Mockery::mock(SecurityAlertService::class);
        $security->shouldReceive('alertPaymentFailed')->andReturnNull();
        $security->shouldReceive('alertAccountLocked')->andReturnNull();
        $this->app->instance(SecurityAlertService::class, $security);

        $this->controller = $this->app->make(StripeWebhookController::class);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private function subscriptionPayload(array $overrides = []): array
    {
        return [
            'data' => [
                'object' => array_merge([
                    'id'                   => 'sub_test_001',
                    'customer'             => 'cus_test_123',
                    'status'               => 'active',
                    'cancel_at_period_end' => false,
                    'current_period_end'   => Carbon::now()->subDay()->timestamp,
                    // Cashier parent handler accesses item['id'], item['price']['product'],
                    // and item['quantity'] — all keys must be present.
                    'items'                => [
                        'data' => [[
                            'id'       => 'si_test_001',
                            'quantity' => 1,
                            'price'    => [
                                'id'      => 'price_abc',
                                'product' => 'prod_test',
                            ],
                        ]],
                    ],
                    'metadata'             => ['plan_key' => 'professional_monthly'],
                ], $overrides),
            ],
        ];
    }

    private function invoicePayload(array $overrides = []): array
    {
        return [
            'data' => [
                'object' => array_merge([
                    'id'            => 'in_test_001',
                    'customer'      => 'cus_test_123',
                    'amount_paid'   => 2900,
                    'attempt_count' => 1,
                ], $overrides),
            ],
        ];
    }

    // ── checkout.session.completed ────────────────────────────────────────────

    public function test_checkout_completed_writes_audit_log(): void
    {
        $payload = [
            'data' => [
                'object' => [
                    'id'       => 'cs_test_001',
                    'customer' => null,
                    'metadata' => [
                        'tenant_id' => 'wh-test-tenant',
                        'plan_key'  => 'professional_monthly',
                    ],
                ],
            ],
        ];

        $this->controller->handleCheckoutSessionCompleted($payload);

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.checkout.completed',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }

    public function test_checkout_completed_missing_tenant_writes_no_audit_log(): void
    {
        $payload = [
            'data' => [
                'object' => [
                    'id'       => 'cs_none',
                    'customer' => 'cus_nonexistent',
                    'metadata' => [],
                ],
            ],
        ];

        $this->controller->handleCheckoutSessionCompleted($payload);

        $this->assertDatabaseCount('audit_logs', 0);
    }

    // ── customer.subscription.created ────────────────────────────────────────

    public function test_subscription_created_writes_audit_log(): void
    {
        $this->controller->handleCustomerSubscriptionCreated(
            $this->subscriptionPayload()
        );

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.subscription.created',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }

    // ── customer.subscription.updated (normal) ────────────────────────────────

    public function test_subscription_updated_writes_audit_log(): void
    {
        $this->controller->handleCustomerSubscriptionUpdated(
            $this->subscriptionPayload(['metadata' => ['plan_key' => 'enterprise']])
        );

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.subscription.updated',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }

    // ── customer.subscription.updated (cancel_at_period_end) ─────────────────

    public function test_subscription_cancellation_scheduled_writes_audit_log(): void
    {
        $futureTs = Carbon::now()->addDays(14)->timestamp;

        $this->controller->handleCustomerSubscriptionUpdated(
            $this->subscriptionPayload([
                'cancel_at_period_end' => true,
                'current_period_end'   => $futureTs,
            ])
        );

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.subscription.cancellation_scheduled',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }

    // ── customer.subscription.deleted (expired) ───────────────────────────────

    public function test_subscription_expired_writes_audit_log(): void
    {
        $this->controller->handleCustomerSubscriptionDeleted(
            $this->subscriptionPayload(['current_period_end' => Carbon::now()->subDay()->timestamp])
        );

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.subscription.expired',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }

    // ── customer.subscription.deleted (cancelled with grace period) ───────────

    public function test_subscription_cancelled_with_grace_period_writes_audit_log(): void
    {
        $futureTs = Carbon::now()->addDays(10)->timestamp;

        $this->controller->handleCustomerSubscriptionDeleted(
            $this->subscriptionPayload(['current_period_end' => $futureTs])
        );

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.subscription.cancelled',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }

    // ── invoice.paid ──────────────────────────────────────────────────────────

    public function test_invoice_paid_writes_audit_log(): void
    {
        $this->controller->handleInvoicePaid($this->invoicePayload());

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.invoice.paid',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }

    // ── invoice.payment_failed ────────────────────────────────────────────────

    public function test_invoice_payment_failed_writes_audit_log(): void
    {
        $this->controller->handleInvoicePaymentFailed(
            $this->invoicePayload(['attempt_count' => 1])
        );

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.invoice.payment_failed',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }

    public function test_invoice_payment_failed_records_attempt_count(): void
    {
        $this->controller->handleInvoicePaymentFailed(
            $this->invoicePayload(['attempt_count' => 2])
        );

        $log = AuditLog::where('event', 'billing.invoice.payment_failed')
            ->where('tenant_id', 'wh-test-tenant')
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals(2, $log->new_values['attempt_count']);
        $this->assertFalse($log->new_values['dunning_queued']);
    }

    // ── payment_intent.payment_failed ────────────────────────────────────────

    public function test_payment_intent_failed_writes_audit_log(): void
    {
        $payload = [
            'data' => [
                'object' => [
                    'id'                 => 'pi_test_001',
                    'customer'           => 'cus_test_123',
                    'amount'             => 2900,
                    'currency'           => 'usd',
                    'last_payment_error' => ['code' => 'card_declined'],
                ],
            ],
        ];

        $this->controller->handlePaymentIntentPaymentFailed($payload);

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.payment_intent.failed',
            'tenant_id' => 'wh-test-tenant',
        ]);
    }
}

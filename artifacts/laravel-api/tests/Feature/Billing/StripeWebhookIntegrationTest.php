<?php

declare(strict_types=1);

namespace Tests\Feature\Billing;

use App\Jobs\SendDunningEmailJob;
use App\Mail\SuspiciousActivityAlert;
use App\Services\PlatformSettingsService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\Support\IntegrationTestCase;

/**
 * Integration tests for the payment-failure alert path triggered via the real
 * Stripe webhook endpoint.
 *
 * These tests POST to POST /api/v1/stripe/webhook with a realistic
 * invoice.payment_failed payload and verify that SecurityAlertService is
 * actually called from within StripeWebhookController::handleInvoicePaymentFailed().
 *
 * STRIPE_WEBHOOK_SECRET is not configured in phpunit.xml, so Cashier's
 * VerifyWebhookSignature middleware is not registered and requests reach the
 * handler directly.
 *
 * Queue::fake() prevents SendDunningEmailJob from executing so the test scope
 * stays focused on the security-alert path only.
 */
class StripeWebhookIntegrationTest extends IntegrationTestCase
{
    private const WEBHOOK_URL = '/api/v1/stripe/webhook';

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function mockSettings(array $settings): void
    {
        $this->mock(PlatformSettingsService::class)
            ->shouldReceive('get')
            ->withAnyArgs()
            ->andReturnUsing(fn (string $key, mixed $default = null) => $settings[$key] ?? $default);
    }

    /**
     * Insert a minimal tenant row directly so no Tenancy observers fire.
     */
    private function createTenant(string $id, string $stripeId): void
    {
        DB::connection('central')->table('tenants')->insert([
            'id'         => $id,
            'name'       => 'Integration Test Tenant',
            'slug'       => 'integration-test-' . $id,
            'status'     => 'active',
            'plan'       => 'professional_monthly',
            'stripe_id'  => $stripeId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Build a realistic invoice.payment_failed Stripe payload.
     */
    private function invoicePaymentFailedPayload(string $stripeCustomerId, string $invoiceId = 'inv_test_001', int $attemptCount = 1): array
    {
        return [
            'type' => 'invoice.payment_failed',
            'data' => [
                'object' => [
                    'id'            => $invoiceId,
                    'customer'      => $stripeCustomerId,
                    'attempt_count' => $attemptCount,
                    'amount_due'    => 9900,
                    'currency'      => 'usd',
                ],
            ],
        ];
    }

    // ── payment_failed alert ─────────────────────────────────────────────────

    /**
     * @test
     * Posting an invoice.payment_failed payload fires a payment_failed security
     * alert when security.alert_on_payment_failure=true.
     */
    public function test_payment_failed_alert_fires_through_webhook_controller_when_enabled(): void
    {
        Queue::fake();
        Mail::fake();

        $stripeId = 'cus_integration_001';
        $this->createTenant('tenant-integration-001', $stripeId);

        $this->mockSettings([
            'security.alert_on_payment_failure' => true,
            'security.admin_alert_email'        => 'admin@platform.test',
        ]);

        $this->postJson(self::WEBHOOK_URL, $this->invoicePaymentFailedPayload($stripeId))
            ->assertStatus(200);

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'payment_failed',
        );
    }

    /**
     * @test
     * No payment_failed alert is sent when security.alert_on_payment_failure=false
     * (the default), even when the webhook is processed correctly.
     */
    public function test_payment_failed_alert_suppressed_through_webhook_controller_when_disabled(): void
    {
        Queue::fake();
        Mail::fake();

        $stripeId = 'cus_integration_002';
        $this->createTenant('tenant-integration-002', $stripeId);

        $this->mockSettings([
            'security.alert_on_payment_failure' => false,
            'security.admin_alert_email'        => 'admin@platform.test',
        ]);

        $this->postJson(self::WEBHOOK_URL, $this->invoicePaymentFailedPayload($stripeId))
            ->assertStatus(200);

        Mail::assertNothingSent();
    }

    /**
     * @test
     * When no tenant matches the Stripe customer ID, the handler returns 200
     * silently without dispatching an alert or dunning jobs.
     */
    public function test_webhook_noop_when_no_matching_tenant_found(): void
    {
        Queue::fake();
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_payment_failure' => true,
            'security.admin_alert_email'        => 'admin@platform.test',
        ]);

        // Use a stripe_id that doesn't match any tenant in the DB.
        $this->postJson(self::WEBHOOK_URL, $this->invoicePaymentFailedPayload('cus_unknown_999'))
            ->assertStatus(200);

        Mail::assertNothingSent();
        Queue::assertNothingPushed();
    }

    /**
     * @test
     * On the first payment failure (attempt_count=1), dunning jobs are queued.
     * The security alert also fires when enabled.
     */
    public function test_dunning_jobs_queued_and_alert_sent_on_first_attempt(): void
    {
        Queue::fake();
        Mail::fake();

        $stripeId = 'cus_integration_003';
        $this->createTenant('tenant-integration-003', $stripeId);

        $this->mockSettings([
            'security.alert_on_payment_failure' => true,
            'security.admin_alert_email'        => 'admin@platform.test',
        ]);

        $this->postJson(self::WEBHOOK_URL, $this->invoicePaymentFailedPayload($stripeId, 'inv_first', 1))
            ->assertStatus(200);

        // Three dunning jobs should be queued (day 1, 3, 7).
        Queue::assertPushed(SendDunningEmailJob::class, 3);

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'payment_failed',
        );
    }

    /**
     * @test
     * On subsequent retry attempts (attempt_count > 1), no additional dunning
     * jobs are queued but the security alert still fires.
     */
    public function test_no_additional_dunning_jobs_on_retry_but_alert_still_fires(): void
    {
        Queue::fake();
        Mail::fake();

        $stripeId = 'cus_integration_004';
        $this->createTenant('tenant-integration-004', $stripeId);

        $this->mockSettings([
            'security.alert_on_payment_failure' => true,
            'security.admin_alert_email'        => 'admin@platform.test',
        ]);

        $this->postJson(self::WEBHOOK_URL, $this->invoicePaymentFailedPayload($stripeId, 'inv_retry', 2))
            ->assertStatus(200);

        // No new dunning jobs on retry attempt.
        Queue::assertNothingPushed();

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'payment_failed',
        );
    }
}

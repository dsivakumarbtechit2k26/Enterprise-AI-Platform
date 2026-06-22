<?php

declare(strict_types=1);

namespace Tests\Feature\Billing;

use App\Mail\SuspiciousActivityAlert;
use App\Models\Tenant;
use App\Services\PlatformSettingsService;
use App\Services\SecurityAlertService;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Tests for the payment-failure security alert path in StripeWebhookController.
 *
 * All tests exercise SecurityAlertService::alertPaymentFailed() directly to
 * avoid Stripe signature verification, DB, and queue side-effects that the
 * full webhook handler requires. The PlatformSettingsService is mocked via
 * the IoC container so that no real DB or cache connection is needed.
 */
class StripeWebhookControllerTest extends TestCase
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Register a PlatformSettingsService mock that returns values from $settings,
     * falling back to the $default argument for unknown keys.
     */
    private function mockSettings(array $settings): void
    {
        $this->mock(PlatformSettingsService::class)
            ->shouldReceive('get')
            ->withAnyArgs()
            ->andReturnUsing(fn (string $key, mixed $default = null) => $settings[$key] ?? $default);
    }

    /**
     * Build an in-memory Tenant (not persisted) with the given attributes.
     * Uses forceFill() so attributes outside $fillable can also be set.
     */
    private function makeTenant(array $attrs = []): Tenant
    {
        return (new Tenant)->forceFill(array_merge([
            'id'   => 'tenant-test-001',
            'name' => 'Acme Corp',
            'plan' => 'professional_monthly',
        ], $attrs));
    }

    // ── payment_failed alert ─────────────────────────────────────────────────

    public function test_sends_payment_failed_alert_when_enabled_in_settings(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_payment_failure' => true,
            'security.admin_alert_email'        => 'admin@platform.test',
        ]);

        $tenant  = $this->makeTenant(['id' => 'tenant-stripe-001']);
        $service = $this->app->make(SecurityAlertService::class);

        $service->alertPaymentFailed($tenant, 'inv_test_ABCDEF', 1);

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'payment_failed',
        );
    }

    public function test_suppresses_payment_failed_alert_when_disabled_in_settings(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_payment_failure' => false,
            'security.admin_alert_email'        => 'admin@platform.test',
        ]);

        $tenant  = $this->makeTenant(['id' => 'tenant-stripe-002']);
        $service = $this->app->make(SecurityAlertService::class);

        $service->alertPaymentFailed($tenant, 'inv_test_GHIJKL', 1);

        Mail::assertNothingSent();
    }

    public function test_suppresses_payment_failed_alert_when_no_admin_email_is_configured(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_payment_failure' => true,
            'security.admin_alert_email'        => '',  // empty — no configured email
        ]);

        // Also clear the fallback from-address so resolveAdminEmail() returns null.
        config(['mail.from.address' => '']);

        $tenant  = $this->makeTenant(['id' => 'tenant-stripe-003']);
        $service = $this->app->make(SecurityAlertService::class);

        // Must not throw — the service handles missing email gracefully.
        $service->alertPaymentFailed($tenant, 'inv_test_MNOPQR', 1);

        Mail::assertNothingSent();
    }

    public function test_sends_payment_failed_alert_for_subsequent_retry_attempts(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_payment_failure' => true,
            'security.admin_alert_email'        => 'admin@platform.test',
        ]);

        $tenant  = $this->makeTenant(['id' => 'tenant-stripe-004']);
        $service = $this->app->make(SecurityAlertService::class);

        // Second Stripe retry (attempt_count=2) — alert must still fire
        $service->alertPaymentFailed($tenant, 'inv_test_STUVWX', 2);

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'payment_failed',
        );
    }

    public function test_payment_failed_alert_is_addressed_to_the_configured_admin_email(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_payment_failure' => true,
            'security.admin_alert_email'        => 'ops-team@platform.test',
        ]);

        $tenant  = $this->makeTenant(['id' => 'tenant-stripe-005']);
        $service = $this->app->make(SecurityAlertService::class);

        $service->alertPaymentFailed($tenant, 'inv_test_YZAB', 1);

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => in_array('ops-team@platform.test', array_column($m->to, 'address'), true),
        );
    }
}

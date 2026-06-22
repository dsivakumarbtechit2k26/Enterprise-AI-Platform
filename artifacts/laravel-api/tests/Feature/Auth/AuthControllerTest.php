<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Mail\SuspiciousActivityAlert;
use App\Models\User;
use App\Services\PlatformSettingsService;
use App\Services\SecurityAlertService;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Tests for security-alert behaviour wired into the login flow.
 *
 * All tests exercise SecurityAlertService directly (no HTTP round-trip) to
 * avoid the central-DB dependency that the full AuthController requires. The
 * PlatformSettingsService is mocked via the IoC container so that no real DB
 * or cache connection is needed.
 */
class AuthControllerTest extends TestCase
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
     * Build an in-memory User (not persisted) with the given attributes.
     * Uses forceFill() so attributes outside $fillable can also be set.
     */
    private function makeUser(array $attrs = []): User
    {
        return (new User)->forceFill(array_merge([
            'id'                => 99,
            'name'              => 'Test User',
            'email'             => 'test@example.com',
            'failed_login_count' => 0,
            'locked_until'      => null,
        ], $attrs));
    }

    // ── login_failure threshold alerts ────────────────────────────────────────

    public function test_sends_login_failure_alert_when_failed_count_reaches_threshold(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => 3,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        $user    = $this->makeUser(['failed_login_count' => 3]);
        $service = $this->app->make(SecurityAlertService::class);

        $service->checkLoginFailureThreshold($user, '192.168.1.100');

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'login_failure',
        );
    }

    public function test_does_not_send_login_failure_alert_when_count_exceeds_threshold(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => 3,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        // Count=4 is ABOVE threshold=3 — the service fires only at exact match
        $user    = $this->makeUser(['failed_login_count' => 4]);
        $service = $this->app->make(SecurityAlertService::class);

        $service->checkLoginFailureThreshold($user, '192.168.1.100');

        Mail::assertNothingSent();
    }

    public function test_does_not_send_login_failure_alert_when_count_is_below_threshold(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => 3,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        $user    = $this->makeUser(['failed_login_count' => 2]);
        $service = $this->app->make(SecurityAlertService::class);

        $service->checkLoginFailureThreshold($user, '192.168.1.100');

        Mail::assertNothingSent();
    }

    public function test_suppresses_login_failure_alert_when_threshold_is_zero(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => 0,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        $user    = $this->makeUser(['failed_login_count' => 10]);
        $service = $this->app->make(SecurityAlertService::class);

        $service->checkLoginFailureThreshold($user, '192.168.1.100');

        Mail::assertNothingSent();
    }

    public function test_suppresses_login_failure_alert_when_threshold_is_negative(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => -1,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        $user    = $this->makeUser(['failed_login_count' => 5]);
        $service = $this->app->make(SecurityAlertService::class);

        $service->checkLoginFailureThreshold($user, '192.168.1.100');

        Mail::assertNothingSent();
    }

    // ── account_locked alerts ────────────────────────────────────────────────

    public function test_sends_account_locked_alert_when_lock_alerting_is_enabled(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_account_lock' => true,
            'security.admin_alert_email'     => 'admin@platform.test',
        ]);

        $user    = $this->makeUser();
        $service = $this->app->make(SecurityAlertService::class);

        $service->alertAccountLocked($user, '10.0.0.55');

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'account_locked',
        );
    }

    public function test_suppresses_account_locked_alert_when_disabled_in_settings(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_account_lock' => false,
            'security.admin_alert_email'     => 'admin@platform.test',
        ]);

        $user    = $this->makeUser();
        $service = $this->app->make(SecurityAlertService::class);

        $service->alertAccountLocked($user, '10.0.0.55');

        Mail::assertNothingSent();
    }

    public function test_threshold_and_lock_alerts_are_independent_of_each_other(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => 3,
            'security.alert_on_account_lock'   => true,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        $service = $this->app->make(SecurityAlertService::class);

        // Threshold alert (count=3 = threshold)
        $service->checkLoginFailureThreshold(
            $this->makeUser(['failed_login_count' => 3]),
            '1.2.3.4',
        );

        // Lock alert
        $service->alertAccountLocked(
            $this->makeUser(['failed_login_count' => 5]),
            '1.2.3.4',
        );

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'login_failure',
        );

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'account_locked',
        );
    }
}

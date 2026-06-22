<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Mail\SuspiciousActivityAlert;
use App\Models\User;
use App\Services\PlatformSettingsService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\Support\IntegrationTestCase;

/**
 * Integration tests for security alerts triggered from the real login path.
 *
 * These tests POST to POST /api/v1/auth/login and assert that
 * SecurityAlertService is actually called from within AuthController (not just
 * from a direct service invocation), verifying the full path wiring.
 *
 * PlatformSettingsService is still mocked so tests are independent of the
 * platform_settings seed data. All other dependencies (User model, AuditLog,
 * etc.) use a live SQLite database provisioned by IntegrationTestCase.
 */
class AuthLoginIntegrationTest extends IntegrationTestCase
{
    private const LOGIN_URL = '/api/v1/auth/login';

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function mockSettings(array $settings): void
    {
        $this->mock(PlatformSettingsService::class)
            ->shouldReceive('get')
            ->withAnyArgs()
            ->andReturnUsing(fn (string $key, mixed $default = null) => $settings[$key] ?? $default);
    }

    /**
     * Create and persist a User on the 'central' (SQLite in tests) connection.
     */
    private function createUser(string $email = 'test@example.com', string $password = 'correct-password'): User
    {
        return User::forceCreate([
            'name'               => 'Integration Tester',
            'email'              => $email,
            'password'           => Hash::make($password),
            'email_verified_at'  => now(),
            'failed_login_count' => 0,
            'locked_until'       => null,
        ]);
    }

    /**
     * POST to the login endpoint with the given credentials.
     */
    private function attemptLogin(string $email, string $password): \Illuminate\Testing\TestResponse
    {
        return $this->postJson(self::LOGIN_URL, [
            'email'    => $email,
            'password' => $password,
        ]);
    }

    // ── login_failure alert ──────────────────────────────────────────────────

    /**
     * @test
     * Posting a wrong password exactly `threshold` times causes the login_failure
     * alert to fire from within AuthController::login().
     */
    public function test_login_failure_alert_fires_from_auth_controller_at_threshold(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => 3,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        $user = $this->createUser('threshold@example.com');

        // Two wrong attempts — below threshold, no alert.
        $this->attemptLogin($user->email, 'wrong-1')->assertStatus(401);
        $this->attemptLogin($user->email, 'wrong-2')->assertStatus(401);
        Mail::assertNothingSent();

        // Third attempt — exactly at threshold → alert fires.
        $this->attemptLogin($user->email, 'wrong-3')->assertStatus(401);

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'login_failure',
        );
    }

    /**
     * @test
     * When the threshold is set to 0 (disabled), no alert is sent regardless
     * of how many bad passwords are submitted.
     */
    public function test_login_failure_alert_suppressed_from_auth_controller_when_threshold_zero(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => 0,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        $user = $this->createUser('zero-threshold@example.com');

        foreach (range(1, 4) as $attempt) {
            $this->attemptLogin($user->email, "wrong-{$attempt}")->assertStatus(401);
        }

        Mail::assertNothingSent();
    }

    // ── account_locked alert ─────────────────────────────────────────────────

    /**
     * @test
     * When a wrong password causes the account to be locked (failed_login_count
     * reaches the hard-coded lock threshold of 5), an account_locked alert is
     * sent from within AuthController::login().
     */
    public function test_account_locked_alert_fires_from_auth_controller_on_lock_transition(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.login_failure_threshold' => 3,  // threshold alert on attempt 3
            'security.alert_on_account_lock'   => true,
            'security.admin_alert_email'       => 'admin@platform.test',
        ]);

        $user = $this->createUser('lockme@example.com');

        // Attempt 1–4: threshold alert fires at 3, lock not yet triggered.
        foreach (range(1, 4) as $i) {
            $this->attemptLogin($user->email, "wrong-{$i}");
        }

        Mail::assertSent(SuspiciousActivityAlert::class, fn ($m) => $m->alertType === 'login_failure');

        // Reset mail capture so we can assert cleanly for the lock event.
        Mail::fake();

        // Attempt 5: triggers lock (count >= 5 hard-coded in incrementFailedLogin).
        $this->attemptLogin($user->email, 'wrong-5')->assertStatus(401);

        Mail::assertSent(
            SuspiciousActivityAlert::class,
            fn ($m) => $m->alertType === 'account_locked',
        );
    }

    /**
     * @test
     * When a user is already locked, the controller returns 403 immediately
     * without calling alertAccountLocked() again.
     */
    public function test_no_duplicate_locked_alert_for_already_locked_account(): void
    {
        Mail::fake();

        $this->mockSettings([
            'security.alert_on_account_lock' => true,
            'security.admin_alert_email'     => 'admin@platform.test',
        ]);

        // Pre-lock the account by setting locked_until in the future.
        $user = User::forceCreate([
            'name'               => 'Pre-Locked User',
            'email'              => 'prelocked@example.com',
            'password'           => Hash::make('correct'),
            'email_verified_at'  => now(),
            'failed_login_count' => 5,
            'locked_until'       => now()->addMinutes(15),
        ]);

        // Request against a locked account → 403, no alert (already fired when lock was created).
        $this->attemptLogin($user->email, 'anything')->assertStatus(403);

        Mail::assertNothingSent();
    }
}

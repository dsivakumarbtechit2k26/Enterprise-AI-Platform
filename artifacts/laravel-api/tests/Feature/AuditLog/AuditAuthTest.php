<?php

declare(strict_types=1);

namespace Tests\Feature\AuditLog;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Verifies that AuditLog rows are written for each authentication event.
 *
 * All tests skip throttle / tenant / quota middleware — those are orthogonal
 * to audit logging and would require full tenant scaffolding to run.
 */
class AuditAuthTest extends TestCase
{
    private const PASS = 'Secure@Pass99!X';

    protected function setUp(): void
    {
        parent::setUp();

        // Prevent actual HTTP calls to haveibeenpwned.com and outgoing emails.
        Http::fake();
        Notification::fake();
    }

    // ── register ──────────────────────────────────────────────────────────────

    public function test_register_writes_user_registered_audit_log(): void
    {
        $this->withoutMiddleware()
            ->postJson('/api/v1/auth/register', [
                'name'                  => 'Test Alice',
                'email'                 => 'alice@example.test',
                'password'              => self::PASS,
                'password_confirmation' => self::PASS,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'user.registered',
        ]);
    }

    // ── login success ─────────────────────────────────────────────────────────

    public function test_login_success_writes_audit_log(): void
    {
        $user = User::factory()->create([
            'email'    => 'bob@example.test',
            'password' => bcrypt(self::PASS),
        ]);

        $this->withoutMiddleware()
            ->postJson('/api/v1/auth/login', [
                'email'    => 'bob@example.test',
                'password' => self::PASS,
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'event'    => 'auth.login.success',
            'actor_id' => $user->id,
        ]);
    }

    // ── login failure — wrong password ────────────────────────────────────────

    public function test_login_wrong_password_writes_failed_audit_log(): void
    {
        $user = User::factory()->create([
            'email' => 'carol@example.test',
        ]);

        $this->withoutMiddleware()
            ->postJson('/api/v1/auth/login', [
                'email'    => 'carol@example.test',
                'password' => 'definitely-wrong',
            ])
            ->assertStatus(401);

        $this->assertDatabaseHas('audit_logs', [
            'event'    => 'auth.login.failed',
            'actor_id' => $user->id,
        ]);
    }

    // ── login failure — unknown user ──────────────────────────────────────────

    public function test_login_unknown_user_writes_failed_audit_log(): void
    {
        $this->withoutMiddleware()
            ->postJson('/api/v1/auth/login', [
                'email'    => 'nobody@example.test',
                'password' => 'whatever',
            ])
            ->assertStatus(401);

        $this->assertDatabaseHas('audit_logs', [
            'event'    => 'auth.login.failed',
        ]);

        $this->assertDatabaseCount('audit_logs', 1);
    }

    // ── logout ────────────────────────────────────────────────────────────────

    public function test_logout_writes_audit_log(): void
    {
        $user  = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withoutMiddleware()
            ->actingAs($user, 'sanctum')
            ->withHeaders(['Authorization' => "Bearer {$token}"])
            ->postJson('/api/v1/auth/logout')
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'event'    => 'auth.logout',
            'actor_id' => $user->id,
        ]);
    }

    // ── logout-all ────────────────────────────────────────────────────────────

    public function test_logout_all_writes_audit_log(): void
    {
        $user  = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withoutMiddleware()
            ->actingAs($user, 'sanctum')
            ->withHeaders(['Authorization' => "Bearer {$token}"])
            ->postJson('/api/v1/auth/logout-all')
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'event'    => 'auth.logout.all_sessions',
            'actor_id' => $user->id,
        ]);
    }
}

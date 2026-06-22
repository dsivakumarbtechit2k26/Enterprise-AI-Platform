<?php

declare(strict_types=1);

namespace Tests\Feature\AuditLog;

use App\Models\AuditLog;
use App\Services\AuditService;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Verifies that audit-logging failures are swallowed at every layer that writes
 * audit rows, so a broken audit pipeline (missing table, DB unavailable) can
 * never crash a primary user-facing request.
 *
 * Two layers are covered:
 *  • AuditLog::record()  — called directly by HTTP controllers (e.g. TenantController)
 *  • AuditService::log() — called by auth/billing controllers via the service layer
 */
class AuditResilienceTest extends TestCase
{
    // ── AuditLog::record() swallows DB errors ─────────────────────────────────

    public function test_audit_log_record_does_not_throw_when_table_is_missing(): void
    {
        DB::statement('DROP TABLE IF EXISTS audit_logs');

        // Must not throw — failures are silently swallowed by design.
        $result = AuditLog::record(
            event:     'tenant.provisioned',
            newValues: ['name' => 'Acme', 'plan' => 'free'],
            tenantId:  'acme',
        );

        $this->assertNull($result, 'record() should return null when the insert fails');
    }

    public function test_audit_log_record_returns_null_on_error(): void
    {
        DB::statement('DROP TABLE IF EXISTS audit_logs');

        $result = AuditLog::record(event: 'any.event', actorId: 1);

        $this->assertNull($result);
    }

    // ── AuditService::log() swallows DB errors ────────────────────────────────

    public function test_audit_service_does_not_throw_when_db_write_fails(): void
    {
        DB::statement('DROP TABLE IF EXISTS audit_logs');

        $audit = $this->app->make(AuditService::class);

        // Must not throw — failures are silently swallowed by design.
        $audit->logAuth('auth.login.success', 1);

        $this->assertTrue(true);
    }

    public function test_audit_service_log_returns_void_on_error(): void
    {
        DB::statement('DROP TABLE IF EXISTS audit_logs');

        $audit  = $this->app->make(AuditService::class);
        $result = $audit->log(event: 'some.event', actorId: 99);

        $this->assertNull($result);
    }

    // ── Auth endpoint stays up even when audit logging is broken ──────────────

    public function test_login_endpoint_succeeds_even_when_audit_log_table_is_missing(): void
    {
        $user = \App\Models\User::factory()->create([
            'email'    => 'resilience@example.test',
            'password' => bcrypt('AnyPassword1!'),
        ]);

        // Break audit logging after the user has been seeded.
        DB::statement('DROP TABLE IF EXISTS audit_logs');

        $this->withoutMiddleware()
            ->postJson('/api/v1/auth/login', [
                'email'    => 'resilience@example.test',
                'password' => 'AnyPassword1!',
            ])
            ->assertStatus(200);
    }
}

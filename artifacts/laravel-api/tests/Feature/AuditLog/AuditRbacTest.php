<?php

declare(strict_types=1);

namespace Tests\Feature\AuditLog;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\RbacAuditLogger;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Verifies that RbacAuditLogger writes AuditLog rows for role-assignment events.
 *
 * These tests call RbacAuditLogger directly rather than going through the HTTP
 * layer because:
 *   1. Role assignment endpoints require full Spatie permission middleware setup.
 *   2. We are testing audit-log coverage, not the HTTP-layer permission checks.
 *
 * The spatie/laravel-activitylog calls (via UserRoleObserver) are exercised as
 * side-effects; we only assert on the AuditLog rows that RbacAuditLogger writes.
 */
class AuditRbacTest extends TestCase
{
    private User $actor;
    private User $target;
    private Role $role;
    private string $tenantId = 'rbac-test-tenant';

    protected function setUp(): void
    {
        parent::setUp();

        $this->actor  = User::factory()->create(['name' => 'Admin Actor']);
        $this->target = User::factory()->create(['name' => 'Target User']);

        // Create a Spatie role scoped to the test tenant.
        // guard_name = 'web' is the default guard Spatie uses.
        $this->role = Role::firstOrCreate(
            ['name' => 'manager', 'guard_name' => 'web'],
        );
    }

    // ── role assigned ─────────────────────────────────────────────────────────

    public function test_role_assigned_writes_audit_log(): void
    {
        RbacAuditLogger::roleAssigned(
            user:     $this->target,
            roleName: $this->role->name,
            tenantId: $this->tenantId,
            actor:    $this->actor,
        );

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'role.assigned',
            'tenant_id' => $this->tenantId,
            'actor_id'  => $this->actor->id,
        ]);
    }

    public function test_role_assigned_audit_log_captures_role_and_user(): void
    {
        RbacAuditLogger::roleAssigned(
            user:     $this->target,
            roleName: $this->role->name,
            tenantId: $this->tenantId,
            actor:    $this->actor,
        );

        $log = AuditLog::where('event', 'role.assigned')
            ->where('tenant_id', $this->tenantId)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($this->role->name, $log->new_values['role']);
        $this->assertEquals($this->target->id, $log->new_values['user_id']);
        $this->assertEquals($this->target->email, $log->new_values['user_email']);
    }

    // ── role revoked ──────────────────────────────────────────────────────────

    public function test_role_revoked_writes_audit_log(): void
    {
        RbacAuditLogger::roleRevoked(
            user:     $this->target,
            roleName: $this->role->name,
            tenantId: $this->tenantId,
            actor:    $this->actor,
        );

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'role.revoked',
            'tenant_id' => $this->tenantId,
            'actor_id'  => $this->actor->id,
        ]);
    }

    public function test_role_revoked_audit_log_captures_role_and_user(): void
    {
        RbacAuditLogger::roleRevoked(
            user:     $this->target,
            roleName: $this->role->name,
            tenantId: $this->tenantId,
            actor:    $this->actor,
        );

        $log = AuditLog::where('event', 'role.revoked')
            ->where('tenant_id', $this->tenantId)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($this->role->name, $log->old_values['role']);
        $this->assertEquals($this->target->id, $log->old_values['user_id']);
    }

    // ── both directions in one test ───────────────────────────────────────────

    public function test_assign_then_revoke_each_write_separate_audit_rows(): void
    {
        RbacAuditLogger::roleAssigned(
            user:     $this->target,
            roleName: $this->role->name,
            tenantId: $this->tenantId,
            actor:    $this->actor,
        );

        RbacAuditLogger::roleRevoked(
            user:     $this->target,
            roleName: $this->role->name,
            tenantId: $this->tenantId,
            actor:    $this->actor,
        );

        $this->assertDatabaseHas('audit_logs', ['event' => 'role.assigned', 'tenant_id' => $this->tenantId]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'role.revoked',  'tenant_id' => $this->tenantId]);

        $this->assertEquals(
            2,
            AuditLog::whereIn('event', ['role.assigned', 'role.revoked'])
                ->where('tenant_id', $this->tenantId)
                ->count(),
        );
    }
}

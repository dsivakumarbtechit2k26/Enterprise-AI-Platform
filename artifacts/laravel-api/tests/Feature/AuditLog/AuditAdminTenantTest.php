<?php

declare(strict_types=1);

namespace Tests\Feature\AuditLog;

use App\Http\Controllers\Api\V1\TenantController;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\TenantRbacSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

/**
 * Verifies that AuditLog rows are written when an admin changes tenant status or
 * plan, and when a new tenant is provisioned.
 *
 * Tenant records are inserted via raw SQL for status/plan tests to bypass
 * stancl/tenancy's model Observer (which creates a physical schema per tenant).
 *
 * The tenant.provisioned test exercises TenantController::store() directly — the
 * real code path where the audit call is wired — by:
 *   1. Mocking TenantRbacSeeder so no real schema/RBAC seeding occurs.
 *   2. Unsetting the Tenant event dispatcher so the tenancy Observer does not
 *      attempt to provision a physical schema during Tenant::create().
 */
class AuditAdminTenantTest extends TestCase
{
    private const ADMIN_KEY = 'test-admin-key-123';

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.platform_admin_key' => self::ADMIN_KEY]);
    }

    private function adminHeaders(): array
    {
        return ['X-Platform-Key' => self::ADMIN_KEY];
    }

    /**
     * Insert a tenant row directly so the tenancy bootstrapper is not triggered.
     */
    private function insertTenant(string $id, array $attrs = []): Tenant
    {
        DB::connection('central')->table('tenants')->insert(array_merge([
            'id'         => $id,
            'name'       => 'Test Tenant ' . $id,
            'slug'       => $id,
            'plan'       => 'free',
            'status'     => 'active',
            'data'       => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ], $attrs));

        return Tenant::find($id);
    }

    // ── tenant status changes ─────────────────────────────────────────────────

    public function test_update_status_to_suspended_writes_audit_log(): void
    {
        $admin  = User::factory()->create();
        $tenant = $this->insertTenant('tenant-suspend-test');

        $this->withoutMiddleware()
            ->actingAs($admin, 'sanctum')
            ->withHeaders($this->adminHeaders())
            ->patchJson("/api/v1/admin/tenants/{$tenant->id}/status", [
                'status' => 'suspended',
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'tenant.suspended',
            'tenant_id' => $tenant->id,
            'actor_id'  => $admin->id,
        ]);
    }

    public function test_update_status_to_active_writes_audit_log(): void
    {
        $admin  = User::factory()->create();
        $tenant = $this->insertTenant('tenant-activate-test', ['status' => 'suspended']);

        $this->withoutMiddleware()
            ->actingAs($admin, 'sanctum')
            ->withHeaders($this->adminHeaders())
            ->patchJson("/api/v1/admin/tenants/{$tenant->id}/status", [
                'status' => 'active',
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'tenant.active',
            'tenant_id' => $tenant->id,
            'actor_id'  => $admin->id,
        ]);
    }

    // ── tenant plan change ────────────────────────────────────────────────────

    public function test_change_plan_writes_audit_log(): void
    {
        $admin  = User::factory()->create();
        $tenant = $this->insertTenant('tenant-plan-test');

        $this->withoutMiddleware()
            ->actingAs($admin, 'sanctum')
            ->withHeaders($this->adminHeaders())
            ->patchJson("/api/v1/admin/tenants/{$tenant->id}/plan", [
                'plan' => 'professional_monthly',
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'tenant.plan_changed',
            'tenant_id' => $tenant->id,
            'actor_id'  => $admin->id,
        ]);
    }

    public function test_change_plan_audit_log_captures_old_and_new_plan(): void
    {
        $admin  = User::factory()->create();
        $tenant = $this->insertTenant('tenant-plan-vals-test', ['plan' => 'free']);

        $this->withoutMiddleware()
            ->actingAs($admin, 'sanctum')
            ->withHeaders($this->adminHeaders())
            ->patchJson("/api/v1/admin/tenants/{$tenant->id}/plan", [
                'plan' => 'enterprise',
            ])
            ->assertStatus(200);

        $log = AuditLog::where('event', 'tenant.plan_changed')
            ->where('tenant_id', $tenant->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals('enterprise', $log->new_values['plan']);
        $this->assertEquals('free', $log->old_values['plan']);
    }

    // ── tenant provisioning ───────────────────────────────────────────────────

    /**
     * Exercises TenantController::store() directly — the actual code path where
     * 'tenant.provisioned' is logged — rather than asserting on AuditLog::record()
     * directly (which would pass even if the controller call were removed).
     *
     * The tenancy schema Observer and TenantRbacSeeder are both bypassed so the
     * test does not require a live PostgreSQL server.
     */
    public function test_tenant_provisioned_audit_log_is_written_by_controller(): void
    {
        $admin = User::factory()->create();

        // 1. Mock TenantRbacSeeder — bound through the container because
        //    TenantController now receives it via constructor injection.
        $seederMock = Mockery::mock(TenantRbacSeeder::class);
        $seederMock->shouldReceive('run')->once()->andReturnNull();
        $this->app->instance(TenantRbacSeeder::class, $seederMock);

        // 2. Disable the Tenant Eloquent event dispatcher so the stancl/tenancy
        //    Observer cannot attempt to create a physical database schema.
        $originalDispatcher = Tenant::getEventDispatcher();
        Tenant::unsetEventDispatcher();

        try {
            $controller = $this->app->make(TenantController::class);

            $request = Request::create(
                '/api/v1/tenants',
                'POST',
                ['name' => 'Provisioned Co', 'email' => 'owner@provisioned.test'],
            );
            $request->setUserResolver(fn () => $admin);

            // Bypass Laravel's request validation by using withoutMiddleware-style
            // approach: directly invoke the controller, which also skips FormRequest
            // but uses the Request::validate() path inline.
            $response = $controller->store($request);

            $this->assertEquals(201, $response->getStatusCode());
        } finally {
            // Always restore the dispatcher — even if the test fails — so other
            // tests in this class are not affected.
            Tenant::setEventDispatcher($originalDispatcher);
        }

        $this->assertDatabaseHas('audit_logs', [
            'event'    => 'tenant.provisioned',
            'actor_id' => $admin->id,
        ]);
    }
}

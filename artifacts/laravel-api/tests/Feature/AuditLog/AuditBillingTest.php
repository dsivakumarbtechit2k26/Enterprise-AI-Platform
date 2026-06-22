<?php

declare(strict_types=1);

namespace Tests\Feature\AuditLog;

use App\Http\Controllers\Api\V1\Billing\BillingController;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use App\Services\BillingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

/**
 * Verifies that BillingController writes an AuditLog row when a checkout
 * session is started.
 *
 * The controller is invoked directly (not through HTTP routing) so that we
 * can inject the active_tenant_id request attribute without depending on the
 * tenant.permissions middleware. This is fine because the test is asserting
 * audit-log coverage, not middleware behaviour.
 */
class AuditBillingTest extends TestCase
{
    private User $user;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();

        // Raw insert to bypass tenancy schema-creation Observer.
        DB::connection('central')->table('tenants')->insert([
            'id'         => 'billing-audit-tenant',
            'name'       => 'Billing Tenant',
            'slug'       => 'billing-audit-tenant',
            'plan'       => 'free',
            'status'     => 'active',
            'data'       => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->tenant = Tenant::find('billing-audit-tenant');

        // Raw insert for SubscriptionPlan — avoids $fillable restrictions on
        // columns like price_cents and avoids the PlanFeature relationship.
        DB::connection('central')->table('subscription_plans')->insert([
            'key'             => 'professional_monthly',
            'name'            => 'Professional Monthly',
            'stripe_price_id' => 'price_pro_monthly_test',
            'price_cents'     => 2900,
            'interval'        => 'month',
            'is_active'       => 1,
            'sort_order'      => 1,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private function billingRequest(array $body = []): Request
    {
        $request = Request::create(
            '/api/v1/billing/checkout',
            'POST',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($body),
        );

        // Simulate what tenant.permissions middleware normally sets.
        $request->attributes->set('active_tenant_id', $this->tenant->id);

        // Inject the authenticated user so $request->user() returns it.
        $request->setUserResolver(fn () => $this->user);

        return $request;
    }

    private function makeMockedBillingService(): BillingService
    {
        $billing = Mockery::mock(BillingService::class);
        $billing->shouldReceive('createCheckoutSession')
            ->andReturn('https://checkout.stripe.com/fake-session');
        $billing->shouldReceive('bustPlanCache')->andReturnNull();
        $billing->shouldReceive('currentSubscriptionStatus')->andReturn([]);

        $this->app->instance(BillingService::class, $billing);

        return $billing;
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    public function test_checkout_started_writes_audit_log(): void
    {
        $this->makeMockedBillingService();

        $controller = $this->app->make(BillingController::class);
        $request    = $this->billingRequest([
            'price_id'    => 'price_pro_monthly_test',
            'success_url' => 'https://example.com/success',
            'cancel_url'  => 'https://example.com/cancel',
        ]);

        $response = $controller->checkout($request);

        $this->assertEquals(200, $response->getStatusCode());

        $this->assertDatabaseHas('audit_logs', [
            'event'     => 'billing.checkout.started',
            'tenant_id' => $this->tenant->id,
            'actor_id'  => $this->user->id,
        ]);
    }

    public function test_checkout_started_audit_log_captures_plan_key_and_price_id(): void
    {
        $this->makeMockedBillingService();

        $controller = $this->app->make(BillingController::class);
        $request    = $this->billingRequest([
            'price_id'    => 'price_pro_monthly_test',
            'success_url' => 'https://example.com/success',
            'cancel_url'  => 'https://example.com/cancel',
        ]);

        $controller->checkout($request);

        $log = AuditLog::where('event', 'billing.checkout.started')
            ->where('tenant_id', $this->tenant->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals('professional_monthly', $log->new_values['plan_key']);
        $this->assertEquals('price_pro_monthly_test', $log->new_values['price_id']);
    }
}

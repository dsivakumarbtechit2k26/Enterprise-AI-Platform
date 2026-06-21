<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SubscriptionPlan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminTenantsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = DB::connection('central')
            ->table('tenants')
            ->leftJoin('user_tenants', 'tenants.id', '=', 'user_tenants.tenant_id')
            ->selectRaw('tenants.*, COUNT(user_tenants.user_id) AS user_count')
            ->groupBy('tenants.id');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('tenants.name', 'ILIKE', "%{$search}%")
                  ->orWhere('tenants.id', 'ILIKE', "%{$search}%");
            });
        }

        if ($status = $request->input('status')) {
            $query->where('tenants.status', $status);
        }

        if ($plan = $request->input('plan')) {
            $query->where('tenants.plan', $plan);
        }

        $paginator = $query
            ->orderBy('tenants.created_at', 'desc')
            ->paginate((int) $request->input('per_page', 20));

        // Fetch all tenant schema sizes in a single PostgreSQL catalog query
        $rawSizes = DB::connection('central')->select("
            SELECT n.nspname AS schema_name,
                   COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint AS storage_bytes
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname NOT LIKE 'pg_%'
              AND n.nspname NOT IN ('information_schema', 'public', 'central', 'topology')
            GROUP BY n.nspname
        ");
        $schemaSizes = collect($rawSizes)->pluck('storage_bytes', 'schema_name');

        $items = collect($paginator->items())->map(fn ($t) => [
            'id'                   => $t->id,
            'name'                 => $t->name,
            'slug'                 => $t->slug ?? $t->id,
            'status'               => $t->status,
            'plan'                 => $t->plan,
            'user_count'           => (int) $t->user_count,
            'storage_bytes'        => (int) $schemaSizes->get($t->id, 0),
            'stripe_id'            => $t->stripe_id,
            'trial_ends_at'        => $t->trial_ends_at,
            'subscription_ends_at' => $t->subscription_ends_at,
            'created_at'           => $t->created_at,
        ])->values();

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    public function show(string $tenantId): JsonResponse
    {
        $tenant = Tenant::findOrFail($tenantId);

        $userCount = DB::connection('central')
            ->table('user_tenants')
            ->where('tenant_id', $tenantId)
            ->count();

        $users = DB::connection('central')
            ->table('user_tenants')
            ->join('users', 'user_tenants.user_id', '=', 'users.id')
            ->where('user_tenants.tenant_id', $tenantId)
            ->select(
                'users.id',
                'users.name',
                'users.email',
                'users.email_verified_at',
                'user_tenants.role',
                'user_tenants.joined_at',
            )
            ->orderBy('user_tenants.joined_at')
            ->get()
            ->map(fn ($u) => [
                'id'             => $u->id,
                'name'           => $u->name,
                'email'          => $u->email,
                'email_verified' => (bool) $u->email_verified_at,
                'role'           => $u->role,
                'joined_at'      => $u->joined_at,
            ]);

        // Cashier schema: billable_type / billable_id / type (not subscriber_* / name)
        $subscription = DB::connection('central')
            ->table('subscriptions')
            ->where('billable_type', Tenant::class)
            ->where('billable_id', $tenantId)
            ->orderByDesc('created_at')
            ->first();

        $subscriptionData = $subscription ? [
            'id'            => $subscription->id,
            'type'          => $subscription->type,
            'stripe_id'     => $subscription->stripe_id,
            'stripe_status' => $subscription->stripe_status,
            'stripe_price'  => $subscription->stripe_price,
            'quantity'      => $subscription->quantity,
            'trial_ends_at' => $subscription->trial_ends_at,
            'ends_at'       => $subscription->ends_at,
            'created_at'    => $subscription->created_at,
        ] : null;

        // ── Quota usage: user count vs plan limits ───────────────────────────
        $planFeatures = [];
        $maxUsers     = null;
        $planModel    = SubscriptionPlan::with('features')
            ->where('key', $tenant->plan)
            ->first();
        if ($planModel) {
            $planFeatures = $planModel->features_map;
            if (isset($planFeatures['max_users'])) {
                $maxUsers = (int) $planFeatures['max_users'];
            }
        }

        $quotaUsage = [
            'user_count'    => $userCount,
            'max_users'     => $maxUsers,
            'plan_features' => $planFeatures,
        ];

        // ── Subscription history: recent billing/plan audit events ───────────
        $subscriptionHistory = AuditLog::with('actor:id,name,email')
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('event', 'LIKE', '%subscription%')
                  ->orWhere('event', 'tenant.plan_changed')
                  ->orWhere('event', 'LIKE', '%invoice%')
                  ->orWhere('event', 'LIKE', '%payment%');
            })
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn ($log) => [
                'id'         => $log->id,
                'event'      => $log->event,
                'actor_name' => $log->actor?->name,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'created_at' => $log->created_at,
            ]);

        return response()->json([
            'data' => [
                'id'                   => $tenant->id,
                'name'                 => $tenant->name,
                'slug'                 => $tenant->slug ?? $tenant->id,
                'status'               => $tenant->status,
                'plan'                 => $tenant->plan,
                'stripe_id'            => $tenant->stripe_id,
                'pm_type'              => $tenant->pm_type,
                'pm_last_four'         => $tenant->pm_last_four,
                'trial_ends_at'        => $tenant->trial_ends_at,
                'subscription_ends_at' => $tenant->subscription_ends_at,
                'settings'             => $tenant->settings,
                'user_count'           => $userCount,
                'storage_bytes'        => (int) (DB::connection('central')->selectOne("
                    SELECT COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint AS storage_bytes
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = ?
                ", [$tenant->id])?->storage_bytes ?? 0),
                'users'                => $users,
                'subscription'         => $subscriptionData,
                'quota_usage'          => $quotaUsage,
                'subscription_history' => $subscriptionHistory,
                'created_at'           => $tenant->created_at,
                'updated_at'           => $tenant->updated_at,
            ],
        ]);
    }

    public function updateStatus(Request $request, string $tenantId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:active,suspended,trial,expired'],
        ]);

        $tenant    = Tenant::findOrFail($tenantId);
        $oldStatus = $tenant->status;
        $tenant->update(['status' => $validated['status']]);

        AuditLog::record(
            event:     "tenant.{$validated['status']}",
            newValues: ['status' => $validated['status']],
            oldValues: ['status' => $oldStatus],
            tenantId:  $tenantId,
            actorId:   $request->user()?->id,
            ipAddress: $request->ip(),
        );

        return response()->json([
            'data'    => ['id' => $tenant->id, 'status' => $tenant->status],
            'message' => "Tenant status updated to {$validated['status']}.",
        ]);
    }

    public function changePlan(Request $request, string $tenantId): JsonResponse
    {
        $validated = $request->validate([
            'plan' => ['required', 'string'],
        ]);

        $tenant  = Tenant::findOrFail($tenantId);
        $oldPlan = $tenant->plan;
        $tenant->update(['plan' => $validated['plan']]);

        AuditLog::record(
            event:     'tenant.plan_changed',
            newValues: ['plan' => $validated['plan']],
            oldValues: ['plan' => $oldPlan],
            tenantId:  $tenantId,
            actorId:   $request->user()?->id,
            ipAddress: $request->ip(),
        );

        return response()->json([
            'data'    => ['id' => $tenant->id, 'plan' => $tenant->plan],
            'message' => "Tenant plan updated to {$validated['plan']}.",
        ]);
    }

    /**
     * Issue a one-time exchange code (stored in cache, 60s TTL).
     * The raw Sanctum token is NEVER returned here — only the exchange code.
     */
    public function impersonate(Request $request, string $tenantId): JsonResponse
    {
        $tenant = Tenant::findOrFail($tenantId);

        $targetUser = DB::connection('central')
            ->table('user_tenants')
            ->join('users', 'user_tenants.user_id', '=', 'users.id')
            ->where('user_tenants.tenant_id', $tenantId)
            ->whereIn('user_tenants.role', ['owner', 'admin'])
            ->orderByRaw("CASE user_tenants.role WHEN 'owner' THEN 0 ELSE 1 END")
            ->select('users.id', 'users.name', 'users.email')
            ->first();

        if (! $targetUser) {
            return response()->json([
                'message' => 'No admin or owner user found for this tenant.',
            ], 404);
        }

        // One-time exchange code — TTL 60 seconds, single use via Cache::pull
        $code = Str::uuid()->toString();

        Cache::put(
            "impersonate:exchange:{$code}",
            [
                'user_id'   => $targetUser->id,
                'tenant_id' => $tenantId,
            ],
            now()->addSeconds(60),
        );

        AuditLog::record(
            event:     'tenant.impersonated',
            newValues: [
                'impersonated_user_id'    => $targetUser->id,
                'impersonated_user_email' => $targetUser->email,
            ],
            tenantId:  $tenantId,
            actorId:   $request->user()?->id,
            ipAddress: $request->ip(),
        );

        return response()->json([
            'data' => [
                'exchange_code' => $code,
                'tenant_id'     => $tenantId,
                'tenant_name'   => $tenant->name,
                'user_name'     => $targetUser->name,
                'user_email'    => $targetUser->email,
                'expires_at'    => now()->addSeconds(60)->toISOString(),
            ],
        ]);
    }

    /**
     * Redeem a one-time exchange code for a 15-minute Sanctum token.
     * No admin auth required — protected by the one-time code TTL.
     */
    public function exchange(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'uuid'],
        ]);

        // Atomically reads and deletes (one-time use guarantee)
        $data = Cache::pull("impersonate:exchange:{$validated['code']}");

        if (! $data) {
            return response()->json([
                'message' => 'Invalid or expired exchange code.',
            ], 403);
        }

        $user = User::findOrFail($data['user_id']);

        $user->tokens()->where('name', 'impersonation')->delete();

        $token = $user->createToken('impersonation', ['*'], now()->addMinutes(15));

        return response()->json([
            'data' => [
                'token'      => $token->plainTextToken,
                'expires_at' => now()->addMinutes(15)->toISOString(),
            ],
        ]);
    }
}

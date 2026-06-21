<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        $items = collect($paginator->items())->map(fn ($t) => [
            'id'                   => $t->id,
            'name'                 => $t->name,
            'slug'                 => $t->slug ?? $t->id,
            'status'               => $t->status,
            'plan'                 => $t->plan,
            'user_count'           => (int) $t->user_count,
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
            ->select('users.id', 'users.name', 'users.email', 'user_tenants.role', 'user_tenants.joined_at')
            ->orderBy('user_tenants.joined_at')
            ->get();

        $subscription = DB::connection('central')
            ->table('subscriptions')
            ->where('subscriber_type', Tenant::class)
            ->where('subscriber_id', $tenantId)
            ->orderByDesc('created_at')
            ->first();

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
                'users'                => $users,
                'subscription'         => $subscription,
                'created_at'           => $tenant->created_at,
                'updated_at'           => $tenant->updated_at,
            ],
        ]);
    }

    public function updateStatus(Request $request, string $tenantId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:active,suspended,trialing'],
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

    public function impersonate(Request $request, string $tenantId): JsonResponse
    {
        $tenant = Tenant::findOrFail($tenantId);

        // Prefer owner, then admin
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

        $user = User::findOrFail($targetUser->id);

        // Revoke any stale impersonation tokens
        $user->tokens()->where('name', 'impersonation')->delete();

        // Issue a 15-minute token
        $token = $user->createToken('impersonation', ['*'], now()->addMinutes(15));

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
                'token'       => $token->plainTextToken,
                'tenant_id'   => $tenantId,
                'tenant_name' => $tenant->name,
                'user_name'   => $targetUser->name,
                'user_email'  => $targetUser->email,
                'expires_at'  => now()->addMinutes(15)->toISOString(),
            ],
        ]);
    }
}

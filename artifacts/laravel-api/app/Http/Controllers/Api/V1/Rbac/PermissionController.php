<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Rbac;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\User;
use App\Services\RbacAuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PermissionController extends Controller
{
    // ── List all permissions ──────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $group  = $request->query('group');
        $search = $request->query('search');

        $query = Permission::query()->select('id', 'name', 'guard_name', 'created_at');

        if ($group) {
            $query->where('name', 'like', "{$group}.%");
        }

        if ($search) {
            $query->where('name', 'like', "%{$search}%");
        }

        $permissions = $query->orderBy('name')->get();

        // Group permissions by resource prefix
        $grouped = $permissions->groupBy(fn ($p) => explode('.', $p->name)[0]);

        return response()->json([
            'data' => $permissions,
            'meta' => [
                'total'  => $permissions->count(),
                'groups' => $grouped->keys(),
            ],
        ]);
    }

    // ── Show a single permission ──────────────────────────────────────────────

    public function show(int $permissionId): JsonResponse
    {
        $permission = Permission::findOrFail($permissionId);

        return response()->json(['data' => $permission]);
    }

    // ── Get user's permissions in current tenant ──────────────────────────────

    public function userPermissions(Request $request): JsonResponse
    {
        $user   = $request->user();
        $teamId = $request->attributes->get('active_tenant_id');

        // Team context was already set by ResolveTenantPermissions middleware
        return response()->json([
            'data' => [
                'user_id'     => $user->id,
                'tenant_id'   => $teamId,
                'roles'       => $user->getRoleNames(),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    // ── Grant permission directly to user ─────────────────────────────────────

    public function grantToUser(Request $request): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();

        $validated = $request->validate([
            'user_id'       => ['required', 'integer', 'exists:central.users,id'],
            'permissions'   => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $user = User::findOrFail($validated['user_id']);
        // Team context already set by middleware
        $user->givePermissionTo($validated['permissions']);

        RbacAuditLogger::permissionsGranted($user, $validated['permissions'], $teamId, $actor);

        return response()->json([
            'message'     => 'Permissions granted.',
            'permissions' => $validated['permissions'],
        ]);
    }

    // ── Revoke permission from user ───────────────────────────────────────────

    public function revokeFromUser(Request $request): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();

        $validated = $request->validate([
            'user_id'       => ['required', 'integer', 'exists:central.users,id'],
            'permissions'   => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $user = User::findOrFail($validated['user_id']);
        // Team context already set by middleware
        foreach ($validated['permissions'] as $perm) {
            $user->revokePermissionTo($perm);
        }

        RbacAuditLogger::permissionsRevoked($user, $validated['permissions'], $teamId, $actor);

        return response()->json([
            'message'     => 'Permissions revoked.',
            'permissions' => $validated['permissions'],
        ]);
    }
}

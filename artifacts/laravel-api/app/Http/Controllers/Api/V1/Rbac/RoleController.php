<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Rbac;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\RbacAuditLogger;
use Database\Seeders\RbacSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    // ── List roles ────────────────────────────────────────────────────────────
    // Read: show both central + tenant roles (actors need to see the full picture)

    public function index(Request $request): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');

        $roles = Role::where(function ($q) use ($teamId) {
            $q->where('team_id', RbacSeeder::CENTRAL_TEAM);
            if ($teamId && $teamId !== RbacSeeder::CENTRAL_TEAM) {
                $q->orWhere('team_id', $teamId);
            }
        })
        ->with('permissions:id,name')
        ->get()
        ->map(fn ($r) => $this->formatRole($r));

        return response()->json(['data' => $roles]);
    }

    // ── Create role ───────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();

        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:100'],
            'permissions'   => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        // Team context already set by ResolveTenantPermissions middleware
        $role = Role::create([
            'name'       => $validated['name'],
            'guard_name' => 'sanctum',
            'team_id'    => $teamId,
        ]);

        if (! empty($validated['permissions'])) {
            $role->syncPermissions($validated['permissions']);
        }

        RbacAuditLogger::roleCreated($role, $teamId, $actor);

        return response()->json([
            'data'    => $this->formatRole($role->fresh('permissions')),
            'message' => 'Role created.',
        ], 201);
    }

    // ── Show role ─────────────────────────────────────────────────────────────
    // Read: can view both central + tenant roles

    public function show(Request $request, int $roleId): JsonResponse
    {
        $role = $this->findRoleForRead($roleId, $request->attributes->get('active_tenant_id'));

        return response()->json(['data' => $this->formatRole($role->load('permissions'))]);
    }

    // ── Update role ───────────────────────────────────────────────────────────
    // Mutation: restricted to roles owned by the current team only

    public function update(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        // findRoleForMutation scopes to the active team — central roles are never
        // returned here for tenant actors, preventing cross-scope mutations.
        $role = $this->findRoleForMutation($roleId, $teamId);

        if (in_array($role->name, ['super-admin', 'platform-admin', 'tenant-admin'])) {
            return response()->json([
                'message' => 'System roles cannot be renamed or have their permissions changed via API.',
                'code'    => 'PROTECTED_ROLE',
            ], 422);
        }

        $validated = $request->validate([
            'name'          => ['sometimes', 'string', 'max:100'],
            'permissions'   => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $oldValues = [
            'name'        => $role->name,
            'permissions' => $role->permissions->pluck('name')->toArray(),
        ];

        if (isset($validated['name'])) {
            $role->update(['name' => $validated['name']]);
        }

        if (array_key_exists('permissions', $validated)) {
            $role->syncPermissions($validated['permissions'] ?? []);
        }

        $role->refresh()->load('permissions');

        RbacAuditLogger::roleUpdated(
            $role,
            $oldValues,
            ['name' => $role->name, 'permissions' => $role->permissions->pluck('name')->toArray()],
            $teamId,
            $actor,
        );

        return response()->json([
            'data'    => $this->formatRole($role),
            'message' => 'Role updated.',
        ]);
    }

    // ── Delete role ───────────────────────────────────────────────────────────

    public function destroy(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        $role   = $this->findRoleForMutation($roleId, $teamId);

        if (in_array($role->name, ['super-admin', 'platform-admin', 'tenant-admin', 'manager', 'member', 'viewer'])) {
            return response()->json([
                'message' => 'Default system roles cannot be deleted.',
                'code'    => 'PROTECTED_ROLE',
            ], 422);
        }

        $roleName = $role->name;
        $role->delete();

        RbacAuditLogger::roleDeleted($roleId, $roleName, $teamId, $actor);

        return response()->json(['message' => 'Role deleted.']);
    }

    // ── List users with this role ─────────────────────────────────────────────

    public function listUsers(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $role   = $this->findRoleForRead($roleId, $teamId);
        $team   = $teamId ?? RbacSeeder::CENTRAL_TEAM;

        $users = User::whereHas('roles', function ($q) use ($role, $team) {
            $q->where('roles.id', $role->id)
              ->where('model_has_roles.team_id', $team);
        })->get(['id', 'name', 'email']);

        return response()->json(['data' => $users]);
    }

    // ── Assign role to user ───────────────────────────────────────────────────

    public function assignToUser(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        $role   = $this->findRoleForMutation($roleId, $teamId);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:central.users,id'],
        ]);

        $user = User::findOrFail($validated['user_id']);
        // Team context already set by middleware
        $user->assignRole($role);

        RbacAuditLogger::roleAssigned($user, $role->name, $teamId, $actor);

        return response()->json(['message' => "Role '{$role->name}' assigned to user."]);
    }

    // ── Remove role from user ─────────────────────────────────────────────────

    public function removeFromUser(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        $role   = $this->findRoleForMutation($roleId, $teamId);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:central.users,id'],
        ]);

        $user = User::findOrFail($validated['user_id']);
        // Team context already set by middleware
        $user->removeRole($role);

        RbacAuditLogger::roleRevoked($user, $role->name, $teamId, $actor);

        return response()->json(['message' => "Role '{$role->name}' removed from user."]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * For READ operations (show, index): finds roles visible to the active team —
     * both central roles and the current tenant's own roles.
     */
    private function findRoleForRead(int $roleId, ?string $teamId): Role
    {
        return Role::where('id', $roleId)
            ->where(function ($q) use ($teamId) {
                $q->where('team_id', RbacSeeder::CENTRAL_TEAM);
                if ($teamId && $teamId !== RbacSeeder::CENTRAL_TEAM) {
                    $q->orWhere('team_id', $teamId);
                }
            })
            ->firstOrFail();
    }

    /**
     * For MUTATION operations (update, delete, assign, remove): strictly scoped to
     * the active team only. Tenant actors CANNOT mutate central/platform roles.
     * Platform actors (team = 'central') can only mutate central roles.
     *
     * This prevents cross-scope authorization breaches where a tenant admin with
     * `roles.*` permissions could affect platform-scoped role objects.
     */
    private function findRoleForMutation(int $roleId, ?string $teamId): Role
    {
        return Role::where('id', $roleId)
            ->where('team_id', $teamId ?? RbacSeeder::CENTRAL_TEAM)
            ->firstOrFail();
    }

    private function formatRole(Role $role): array
    {
        return [
            'id'          => $role->id,
            'name'        => $role->name,
            'guard_name'  => $role->guard_name,
            'team_id'     => $role->team_id,
            'permissions' => $role->relationLoaded('permissions')
                ? $role->permissions->pluck('name')
                : null,
            'created_at'  => $role->created_at,
            'updated_at'  => $role->updated_at,
        ];
    }
}

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
            'name'        => ['required', 'string', 'max:100'],
            'permissions' => ['nullable', 'array'],
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

        RbacAuditLogger::log(
            actorId:       $actor->id,
            event:         'role.created',
            auditableType: Role::class,
            auditableId:   $role->id,
            tenantId:      $teamId,
            newValues:     [
                'name'        => $role->name,
                'permissions' => $validated['permissions'] ?? [],
            ],
        );

        return response()->json([
            'data'    => $this->formatRole($role->fresh('permissions')),
            'message' => 'Role created.',
        ], 201);
    }

    // ── Show role ─────────────────────────────────────────────────────────────

    public function show(Request $request, int $roleId): JsonResponse
    {
        $role = $this->findRole($roleId, $request->attributes->get('active_tenant_id'));

        return response()->json(['data' => $this->formatRole($role->load('permissions'))]);
    }

    // ── Update role ───────────────────────────────────────────────────────────

    public function update(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        $role   = $this->findRole($roleId, $teamId);

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

        RbacAuditLogger::log(
            actorId:       $actor->id,
            event:         'role.updated',
            auditableType: Role::class,
            auditableId:   $role->id,
            tenantId:      $teamId,
            oldValues:     $oldValues,
            newValues:     [
                'name'        => $role->name,
                'permissions' => $role->permissions->pluck('name')->toArray(),
            ],
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
        $role   = $this->findRole($roleId, $teamId);

        if (in_array($role->name, ['super-admin', 'platform-admin', 'tenant-admin', 'manager', 'member', 'viewer'])) {
            return response()->json([
                'message' => 'Default system roles cannot be deleted.',
                'code'    => 'PROTECTED_ROLE',
            ], 422);
        }

        $roleName = $role->name;
        $role->delete();

        RbacAuditLogger::log(
            actorId:       $actor->id,
            event:         'role.deleted',
            auditableType: Role::class,
            auditableId:   $roleId,
            tenantId:      $teamId,
            oldValues:     ['name' => $roleName],
        );

        return response()->json(['message' => 'Role deleted.']);
    }

    // ── Assign role to user ───────────────────────────────────────────────────

    public function assignToUser(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        $role   = $this->findRole($roleId, $teamId);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:central.users,id'],
        ]);

        $user = User::findOrFail($validated['user_id']);
        // Team context already set by middleware
        $user->assignRole($role);

        RbacAuditLogger::log(
            actorId:       $actor->id,
            event:         'role.assigned',
            auditableType: User::class,
            auditableId:   $user->id,
            tenantId:      $teamId,
            newValues:     ['role' => $role->name, 'assigned_by' => $actor->id],
        );

        return response()->json(['message' => "Role '{$role->name}' assigned to user."]);
    }

    // ── Remove role from user ─────────────────────────────────────────────────

    public function removeFromUser(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        $role   = $this->findRole($roleId, $teamId);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:central.users,id'],
        ]);

        $user = User::findOrFail($validated['user_id']);
        // Team context already set by middleware
        $user->removeRole($role);

        RbacAuditLogger::log(
            actorId:       $actor->id,
            event:         'role.revoked',
            auditableType: User::class,
            auditableId:   $user->id,
            tenantId:      $teamId,
            oldValues:     ['role' => $role->name, 'revoked_by' => $actor->id],
        );

        return response()->json(['message' => "Role '{$role->name}' removed from user."]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function findRole(int $roleId, ?string $teamId): Role
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

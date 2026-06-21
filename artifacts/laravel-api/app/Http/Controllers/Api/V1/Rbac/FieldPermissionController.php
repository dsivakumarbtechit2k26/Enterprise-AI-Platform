<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Rbac;

use App\Http\Controllers\Controller;
use App\Models\FieldPermission;
use App\Models\Role;
use App\Services\RbacAuditLogger;
use Database\Seeders\RbacSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FieldPermissionController extends Controller
{
    // ── List field permissions for a role ─────────────────────────────────────

    public function index(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $role   = $this->findRoleForRead($roleId, $teamId);

        $fieldPerms = FieldPermission::where('role_id', $role->id)
            ->where(fn ($q) => $q->where('team_id', RbacSeeder::CENTRAL_TEAM)
                ->orWhere('team_id', $teamId))
            ->orderBy('model_class')
            ->orderBy('field_name')
            ->get();

        return response()->json(['data' => $fieldPerms]);
    }

    // ── Upsert field permission ───────────────────────────────────────────────

    public function upsert(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        $role   = $this->findRoleForMutation($roleId, $teamId);

        $validated = $request->validate([
            'model_class' => ['required', 'string', 'max:255'],
            'field_name'  => ['required', 'string', 'max:100'],
            'can_read'    => ['required', 'boolean'],
            'can_write'   => ['required', 'boolean'],
        ]);

        $existing = FieldPermission::where('role_id', $role->id)
            ->where('model_class', $validated['model_class'])
            ->where('field_name', $validated['field_name'])
            ->where('team_id', $teamId)
            ->first();

        $oldValues = $existing
            ? ['can_read' => $existing->can_read, 'can_write' => $existing->can_write]
            : [];

        $fp = FieldPermission::updateOrCreate(
            [
                'role_id'     => $role->id,
                'model_class' => $validated['model_class'],
                'field_name'  => $validated['field_name'],
                'team_id'     => $teamId,
            ],
            [
                'can_read'  => $validated['can_read'],
                'can_write' => $validated['can_write'],
            ]
        );

        RbacAuditLogger::fieldPermissionSaved($fp, ! $existing, $oldValues, $teamId, $actor);

        return response()->json([
            'data'    => $fp,
            'message' => 'Field permission saved.',
        ]);
    }

    // ── Delete field permission ───────────────────────────────────────────────

    public function destroy(Request $request, int $roleId, int $fieldPermId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $actor  = $request->user();
        $this->findRoleForMutation($roleId, $teamId);

        // Tenant actors may only delete field permissions scoped to their own team.
        // Central field permissions are immutable from tenant context.
        $fp = FieldPermission::where('id', $fieldPermId)
            ->where('role_id', $roleId)
            ->where('team_id', $teamId)
            ->firstOrFail();

        $oldValues = [
            'model_class' => $fp->model_class,
            'field_name'  => $fp->field_name,
            'can_read'    => $fp->can_read,
            'can_write'   => $fp->can_write,
        ];

        $fp->delete();

        RbacAuditLogger::fieldPermissionDeleted($fieldPermId, $oldValues, $teamId, $actor);

        return response()->json(['message' => 'Field permission deleted.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * For read operations: allows viewing field permissions on both central and
     * tenant-scoped roles so tenant users can inspect inherited central rules.
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
     * For mutation operations: strictly scoped to the active team only.
     * Tenant actors cannot create/update/delete field permissions on central roles.
     * Central actors (team_id === 'central') operate on central roles.
     */
    private function findRoleForMutation(int $roleId, ?string $teamId): Role
    {
        return Role::where('id', $roleId)
            ->where('team_id', $teamId ?? RbacSeeder::CENTRAL_TEAM)
            ->firstOrFail();
    }
}

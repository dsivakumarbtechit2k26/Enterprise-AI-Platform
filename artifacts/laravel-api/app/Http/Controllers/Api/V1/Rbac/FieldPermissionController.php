<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Rbac;

use App\Http\Controllers\Controller;
use App\Models\FieldPermission;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FieldPermissionController extends Controller
{
    // ── List field permissions for a role ─────────────────────────────────────

    public function index(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $role   = $this->findRole($roleId, $teamId);

        $fieldPerms = FieldPermission::where('role_id', $role->id)
            ->where(fn ($q) => $q->whereNull('team_id')->orWhere('team_id', $teamId))
            ->orderBy('model_class')
            ->orderBy('field_name')
            ->get();

        return response()->json(['data' => $fieldPerms]);
    }

    // ── Upsert field permission ───────────────────────────────────────────────

    public function upsert(Request $request, int $roleId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $role   = $this->findRole($roleId, $teamId);

        $validated = $request->validate([
            'model_class' => ['required', 'string', 'max:255'],
            'field_name'  => ['required', 'string', 'max:100'],
            'can_read'    => ['required', 'boolean'],
            'can_write'   => ['required', 'boolean'],
        ]);

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

        return response()->json([
            'data'    => $fp,
            'message' => 'Field permission saved.',
        ]);
    }

    // ── Delete field permission ───────────────────────────────────────────────

    public function destroy(Request $request, int $roleId, int $fieldPermId): JsonResponse
    {
        $teamId = $request->attributes->get('active_tenant_id');
        $this->findRole($roleId, $teamId);

        $fp = FieldPermission::where('id', $fieldPermId)
            ->where('role_id', $roleId)
            ->where(fn ($q) => $q->whereNull('team_id')->orWhere('team_id', $teamId))
            ->firstOrFail();

        $fp->delete();

        return response()->json(['message' => 'Field permission deleted.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function findRole(int $roleId, ?string $teamId): Role
    {
        return Role::where('id', $roleId)
            ->where(fn ($q) => $q->whereNull('team_id')->orWhere('team_id', $teamId))
            ->firstOrFail();
    }
}

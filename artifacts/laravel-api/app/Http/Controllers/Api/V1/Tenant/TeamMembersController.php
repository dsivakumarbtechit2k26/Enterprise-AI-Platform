<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Returns a lightweight list of users who belong to the active tenant.
 * Used by dynamic form fields (user_picker) to populate a selector —
 * this endpoint is intentionally scoped to the active tenant, not global.
 */
class TeamMembersController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->header('X-Tenant-ID');

        if (! $tenantId) {
            return response()->json([
                'type'   => 'https://platform.local/errors/no-tenant-context',
                'title'  => 'No Tenant Context',
                'status' => 400,
                'detail' => 'X-Tenant-ID header is required.',
            ], 400);
        }

        // Fetch users belonging to this tenant via the central pivot table.
        $members = User::whereExists(function ($q) use ($tenantId) {
            $q->select(DB::raw(1))
              ->from('user_tenants')
              ->whereColumn('user_tenants.user_id', 'users.id')
              ->where('user_tenants.tenant_id', $tenantId);
        })
        ->select('id', 'name', 'email')
        ->orderBy('name')
        ->get();

        return response()->json(['data' => $members]);
    }
}

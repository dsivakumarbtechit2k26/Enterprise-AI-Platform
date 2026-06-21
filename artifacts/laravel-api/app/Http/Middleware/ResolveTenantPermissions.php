<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Database\Seeders\RbacSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the active tenant from the request and sets the spatie
 * permission team ID so that role/permission checks are scoped to
 * the correct tenant.
 *
 * Tenant resolution order:
 *  1. X-Tenant-ID header
 *  2. Authenticated user's current_tenant_id
 *
 * If no tenant is resolved, falls back to 'central' (platform scope).
 *
 * Apply to any route group that needs tenant-scoped RBAC.
 */
class ResolveTenantPermissions
{
    public function __construct(private PermissionRegistrar $registrar) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $request->header('X-Tenant-ID')
            ?? optional($request->user())->current_tenant_id;

        if ($tenantId) {
            $exists = DB::connection('central')
                ->table('tenants')
                ->where('id', $tenantId)
                ->exists();

            if (! $exists) {
                return response()->json([
                    'message' => 'Tenant not found.',
                    'code'    => 'TENANT_NOT_FOUND',
                ], 404);
            }

            if ($request->user()) {
                $isMember = DB::connection('central')
                    ->table('user_tenants')
                    ->where('user_id', $request->user()->id)
                    ->where('tenant_id', $tenantId)
                    ->exists();

                // Check central super-admin without switching team context
                $isSuperAdmin = $this->isSuperAdmin($request->user()->id);

                if (! $isMember && ! $isSuperAdmin) {
                    return response()->json([
                        'message' => 'You are not a member of this tenant.',
                        'code'    => 'TENANT_ACCESS_DENIED',
                    ], 403);
                }
            }

            $this->registrar->setPermissionsTeamId($tenantId);
            $this->registrar->forgetCachedPermissions();
            $request->attributes->set('active_tenant_id', $tenantId);
        } else {
            // No tenant context: use central/platform scope
            $this->registrar->setPermissionsTeamId(RbacSeeder::CENTRAL_TEAM);
            $this->registrar->forgetCachedPermissions();
            $request->attributes->set('active_tenant_id', RbacSeeder::CENTRAL_TEAM);
        }

        return $next($request);
    }

    private function isSuperAdmin(int $userId): bool
    {
        $currentTeam = $this->registrar->getPermissionsTeamId();
        $this->registrar->setPermissionsTeamId(RbacSeeder::CENTRAL_TEAM);
        $this->registrar->forgetCachedPermissions();

        $result = DB::connection('central')
            ->table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_has_roles.model_id', $userId)
            ->where('model_has_roles.model_type', \App\Models\User::class)
            ->where('model_has_roles.team_id', RbacSeeder::CENTRAL_TEAM)
            ->where('roles.name', 'super-admin')
            ->exists();

        $this->registrar->setPermissionsTeamId($currentTeam);
        return $result;
    }
}

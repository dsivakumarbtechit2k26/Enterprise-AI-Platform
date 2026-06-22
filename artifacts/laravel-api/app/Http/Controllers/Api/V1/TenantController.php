<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tenant;
use Database\Seeders\TenantRbacSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TenantController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'  => ['required', 'string', 'max:255'],
            'slug'  => ['nullable', 'string', 'max:63', 'regex:/^[a-z0-9-]+$/', 'unique:central.tenants,id'],
            'plan'  => ['nullable', 'string', 'in:free,trial,professional_monthly,professional_yearly,enterprise'],
            'email' => ['required', 'email'],
        ]);

        $slug = $validated['slug'] ?? Str::slug($validated['name']);

        // Wrap tenant creation + RBAC bootstrap in a transaction.
        // If role seeding fails, the tenant record is rolled back — preventing
        // orphaned tenants with no default roles/permissions.
        $tenant = DB::connection('central')->transaction(function () use ($validated, $slug) {
            $tenant = Tenant::create([
                'id'     => $slug,
                'name'   => $validated['name'],
                'slug'   => $slug,
                'plan'   => $validated['plan'] ?? 'free',
                'status' => 'active',
                'data'   => [
                    'owner_email' => $validated['email'],
                    'created_via' => 'api',
                ],
            ]);

            // Seed tenant-scoped RBAC roles (tenant-admin, manager, member, viewer).
            // Any failure here aborts and rolls back the tenant creation.
            (new TenantRbacSeeder())->run($tenant->id);

            return $tenant;
        });

        AuditLog::record(
            event:     'tenant.provisioned',
            newValues: [
                'name'   => $tenant->name,
                'plan'   => $tenant->plan,
                'status' => $tenant->status,
            ],
            tenantId:  $tenant->id,
            actorId:   $request->user()?->id,
            ipAddress: $request->ip(),
        );

        return response()->json([
            'data' => [
                'id'     => $tenant->id,
                'name'   => $tenant->name,
                'plan'   => $tenant->plan,
                'status' => $tenant->status,
            ],
            'message' => 'Tenant provisioned successfully.',
        ], 201);
    }

    public function show(string $tenant): JsonResponse
    {
        $tenantModel = Tenant::findOrFail($tenant);

        return response()->json([
            'data' => [
                'id'     => $tenantModel->id,
                'name'   => $tenantModel->name,
                'plan'   => $tenantModel->plan,
                'status' => $tenantModel->status,
            ],
        ]);
    }
}

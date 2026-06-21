<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

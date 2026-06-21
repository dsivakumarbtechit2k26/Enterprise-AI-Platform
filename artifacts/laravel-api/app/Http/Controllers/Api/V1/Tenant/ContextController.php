<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class ContextController extends Controller
{
    public function show(): JsonResponse
    {
        $tenant = tenant();

        if (! $tenant) {
            return response()->json([
                'type'   => 'https://platform.local/errors/tenant-not-initialized',
                'title'  => 'Tenant Not Initialized',
                'status' => 400,
                'detail' => 'No tenant context is active for this request.',
            ], 400);
        }

        return response()->json([
            'data' => [
                'tenant_id' => $tenant->getTenantKey(),
                'name'      => $tenant->name ?? null,
                'plan'      => $tenant->plan ?? null,
                'status'    => $tenant->status ?? null,
                'schema'    => 'tenant_' . $tenant->getTenantKey(),
            ],
        ]);
    }
}

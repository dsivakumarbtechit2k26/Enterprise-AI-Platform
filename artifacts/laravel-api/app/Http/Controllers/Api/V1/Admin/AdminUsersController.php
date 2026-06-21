<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;

class AdminUsersController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = DB::connection('central')
            ->table('users')
            ->leftJoin('user_tenants', 'users.id', '=', 'user_tenants.user_id')
            ->leftJoin('tenants', 'user_tenants.tenant_id', '=', 'tenants.id')
            ->selectRaw("
                users.id,
                users.name,
                users.email,
                users.created_at,
                users.email_verified_at,
                STRING_AGG(DISTINCT tenants.id,   ',') AS tenant_ids,
                STRING_AGG(DISTINCT tenants.name, ',') AS tenant_names,
                STRING_AGG(DISTINCT user_tenants.role, ',') AS roles
            ")
            ->groupBy(
                'users.id',
                'users.name',
                'users.email',
                'users.created_at',
                'users.email_verified_at',
            );

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('users.name',  'ILIKE', "%{$search}%")
                  ->orWhere('users.email', 'ILIKE', "%{$search}%");
            });
        }

        $paginator = $query
            ->orderBy('users.created_at', 'desc')
            ->paginate((int) $request->input('per_page', 20));

        $items = collect($paginator->items())->map(fn ($u) => [
            'id'             => $u->id,
            'name'           => $u->name,
            'email'          => $u->email,
            'email_verified' => ! is_null($u->email_verified_at),
            'tenant_ids'     => $u->tenant_ids   ? explode(',', $u->tenant_ids)   : [],
            'tenant_names'   => $u->tenant_names ? explode(',', $u->tenant_names) : [],
            'roles'          => $u->roles        ? array_unique(explode(',', $u->roles)) : [],
            'created_at'     => $u->created_at,
        ])->values();

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    public function resetPassword(Request $request, int $userId): JsonResponse
    {
        $user   = User::findOrFail($userId);
        $status = Password::broker()->sendResetLink(['email' => $user->email]);

        return response()->json(
            ['message' => $status === Password::RESET_LINK_SENT
                ? 'Password reset email sent successfully.'
                : 'Unable to send reset email at this time.'],
            $status === Password::RESET_LINK_SENT ? 200 : 422,
        );
    }
}

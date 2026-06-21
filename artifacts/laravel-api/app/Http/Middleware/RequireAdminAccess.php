<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

class RequireAdminAccess
{
    public function __construct(private PermissionRegistrar $registrar) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Force team context to 'central' so Spatie looks up platform-level permissions.
        $this->registrar->setPermissionsTeamId('central');

        $user = $request->user();

        if (! $user || ! $user->hasPermissionTo('platform.admin')) {
            return response()->json([
                'type'   => 'https://platform.local/errors/forbidden',
                'title'  => 'Forbidden',
                'status' => Response::HTTP_FORBIDDEN,
                'detail' => 'Platform admin access required.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}

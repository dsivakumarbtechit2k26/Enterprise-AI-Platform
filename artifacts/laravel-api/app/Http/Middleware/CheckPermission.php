<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to check that the authenticated user has a specific permission.
 *
 * Usage in routes:
 *   ->middleware('permission:view.users')
 *   ->middleware('permission:create.invoices|update.invoices')  // any of these
 *
 * Usage with role:
 *   ->middleware('role:tenant-admin')
 *   ->middleware('role_or_permission:tenant-admin|view.users')
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission, string $guard = 'sanctum'): Response
    {
        $authGuard = app('auth')->guard($guard);

        if ($authGuard->guest()) {
            throw UnauthorizedException::notLoggedIn();
        }

        $permissions = is_array($permission) ? $permission : explode('|', $permission);

        foreach ($permissions as $perm) {
            if ($authGuard->user()->can($perm)) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'You do not have the required permissions.',
            'code'    => 'PERMISSION_DENIED',
        ], 403);
    }
}

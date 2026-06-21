<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to check that the authenticated user has a specific role.
 *
 * Usage: ->middleware('role:tenant-admin')
 *        ->middleware('role:tenant-admin|manager')  // any of these roles
 */
class CheckRole
{
    public function handle(Request $request, Closure $next, string $role, string $guard = 'sanctum'): Response
    {
        $authGuard = app('auth')->guard($guard);

        if ($authGuard->guest()) {
            throw UnauthorizedException::notLoggedIn();
        }

        $roles = is_array($role) ? $role : explode('|', $role);

        if (! $authGuard->user()->hasAnyRole($roles)) {
            return response()->json([
                'message' => 'You do not have the required role.',
                'code'    => 'ROLE_DENIED',
            ], 403);
        }

        return $next($request);
    }
}

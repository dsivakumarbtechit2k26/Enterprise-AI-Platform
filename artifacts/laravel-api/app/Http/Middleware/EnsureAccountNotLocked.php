<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountNotLocked
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->isLocked()) {
            return response()->json([
                'type'        => 'https://platform.local/errors/account-locked',
                'title'       => 'Account Locked',
                'status'      => Response::HTTP_FORBIDDEN,
                'detail'      => 'Your account has been temporarily locked due to too many failed login attempts.',
                'locked_until' => $user->locked_until?->toIso8601String(),
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}

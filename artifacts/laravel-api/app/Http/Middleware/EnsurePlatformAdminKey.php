<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformAdminKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $platformKey = config('app.platform_admin_key');

        if ($platformKey && $request->header('X-Platform-Key') !== $platformKey) {
            return response()->json([
                'type'   => 'https://platform.local/errors/unauthenticated',
                'title'  => 'Unauthenticated',
                'status' => Response::HTTP_UNAUTHORIZED,
                'detail' => 'A valid X-Platform-Key header is required for this endpoint.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return $next($request);
    }
}

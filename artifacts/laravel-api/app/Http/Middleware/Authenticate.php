<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Return null for API routes so that unauthenticated requests get a 401
     * JSON response instead of a redirect to a non-existent login page.
     */
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}

<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | For SPA cookie-based auth (Sanctum stateful), CORS must allow credentials
    | and only permit the registered frontend origin — not wildcard.
    | For development, FRONTEND_URL defaults to localhost:3000.
    |
    */

    'paths' => ['api/*', 'up', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Allow the registered frontend origin (env-configured) + localhost for dev
    'allowed_origins' => array_filter(array_unique([
        env('FRONTEND_URL', 'http://localhost:3000'),
        'http://localhost:3000',
        'http://localhost:5173', // Vite dev server
        'http://127.0.0.1:3000',
    ])),

    'allowed_origins_patterns' => [
        // Allow any *.replit.dev / *.repl.co preview domain in development
        env('APP_ENV') !== 'production' ? '/^https:\/\/[a-z0-9\-]+\.(replit\.dev|repl\.co)$/' : '',
    ],

    'allowed_headers' => [
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Requested-With',
        'X-Platform-Key',
        'X-Tenant-ID',
        'Origin',
    ],

    'exposed_headers' => ['X-Request-Id', 'X-Tenant-Id'],

    'max_age' => 86400,

    // Required for Sanctum SPA cookie mode (sends session cookies cross-origin)
    'supports_credentials' => true,

];

<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Allow the React frontend (served by Replit's proxy or a separate Vite
    | dev server) to reach the API. In production, restrict to the actual
    | domain(s) used by the frontend.
    |
    */

    'paths' => ['api/*', 'up', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['X-Request-Id', 'X-Tenant-Id'],

    'max_age' => 86400,

    'supports_credentials' => false,

];

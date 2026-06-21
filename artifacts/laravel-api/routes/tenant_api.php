<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\InitializeTenancyByRequestData;
use App\Http\Controllers\Api\V1\Tenant\ContextController;

/*
|--------------------------------------------------------------------------
| Tenant API Routes
|--------------------------------------------------------------------------
|
| Routes that run in a tenant context. The tenant is resolved from the
| X-Tenant-ID request header (or ?tenant= query parameter).
| Apply InitializeTenancyByRequestData to all routes in this group.
|
*/

Route::prefix('api/v1/tenant')
    ->middleware(['api', InitializeTenancyByRequestData::class])
    ->group(function () {

        // Verify tenant context is active
        Route::get('/context', [ContextController::class, 'show'])
            ->name('api.v1.tenant.context');

    });

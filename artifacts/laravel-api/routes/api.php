<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Controllers\Api\V1\PlatformController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Central API routes. Tenant-specific routes live in routes/tenant.php.
|
*/

Route::prefix('v1')->group(function () {

    // Public endpoints
    Route::get('/health', [HealthController::class, 'check'])->name('api.v1.health');
    Route::get('/version', [HealthController::class, 'version'])->name('api.v1.version');

    // Platform info (public)
    Route::get('/platform/plans', [PlatformController::class, 'plans'])->name('api.v1.platform.plans');

    // Tenant provisioning (called internally / by admin)
    Route::post('/tenants', [TenantController::class, 'store'])->name('api.v1.tenants.store');
    Route::get('/tenants/{tenant}', [TenantController::class, 'show'])->name('api.v1.tenants.show');

});

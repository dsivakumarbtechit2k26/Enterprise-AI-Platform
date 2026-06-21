<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(\App\Services\PlatformSettingsService::class);
    }

    public function boot(): void
    {
        // Enforce strict mode in non-production
        Model::shouldBeStrict(! app()->isProduction());

        // Set default connection to central for all Models not specifying a connection
        DB::setDefaultConnection('central');
    }
}

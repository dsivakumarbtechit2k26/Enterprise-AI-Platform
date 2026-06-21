<?php

namespace App\Providers;

use App\Console\Commands\CreateStripePlansCommand;
use App\Console\Commands\MakeTenantPolicyCommand;
use App\Console\Commands\ResetUsageCountersCommand;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Observers\UserRoleObserver;
use Database\Seeders\RbacSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Laravel\Cashier\Cashier;
use Spatie\Permission\PermissionRegistrar;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(\App\Services\PlatformSettingsService::class);
        $this->app->singleton(\App\Services\BillingService::class);
        $this->app->singleton(\App\Services\UsageTracker::class);
        $this->app->singleton(\App\Services\InvoiceService::class);
    }

    public function boot(): void
    {
        // Enforce strict mode in non-production
        Model::shouldBeStrict(! app()->isProduction());

        // Set default connection to central for all Models not specifying a connection
        DB::setDefaultConnection('central');

        // Default permission team = central (platform scope)
        app(PermissionRegistrar::class)->setPermissionsTeamId(RbacSeeder::CENTRAL_TEAM);

        // super-admin bypasses ALL gate checks (checked against central team)
        Gate::before(function (\App\Models\User $user, string $ability) {
            // Check super-admin using a direct DB query to avoid team-context issues
            return DB::connection('central')
                ->table('model_has_roles')
                ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
                ->where('model_has_roles.model_id', $user->id)
                ->where('model_has_roles.model_type', \App\Models\User::class)
                ->where('model_has_roles.team_id', RbacSeeder::CENTRAL_TEAM)
                ->where('roles.name', 'super-admin')
                ->exists() ? true : null;
        });

        // Register observer for User role pivot events
        User::observe(UserRoleObserver::class);

        // Configure Cashier to use our polymorphic TenantSubscription model
        Cashier::useSubscriptionModel(TenantSubscription::class);

        // Point Cashier at the Tenant model (not User)
        Cashier::useCustomerModel(\App\Models\Tenant::class);

        if ($this->app->runningInConsole()) {
            $this->commands([
                MakeTenantPolicyCommand::class,
                CreateStripePlansCommand::class,
                ResetUsageCountersCommand::class,
            ]);
        }
    }
}

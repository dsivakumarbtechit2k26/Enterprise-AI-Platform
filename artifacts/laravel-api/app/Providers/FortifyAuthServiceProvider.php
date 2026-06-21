<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\PersonalAccessToken;
use App\Services\MfaService;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;
use Laravel\Fortify\Fortify;
use Laravel\Sanctum\Sanctum;
use PragmaRX\Google2FA\Google2FA;

class FortifyAuthServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Tell Sanctum to use our custom model (which sets $connection = 'central')
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // Bind Google2FA + MfaService into the container
        $this->app->singleton(Google2FA::class, fn () => new Google2FA());
        $this->app->singleton(MfaService::class, fn ($app) => new MfaService($app->make(Google2FA::class)));
    }

    public function boot(): void
    {
        // Disable Fortify's built-in route registration — we manage our own API routes
        Fortify::ignoreRoutes();

        // Custom password reset URL — points to the frontend reset page
        // Frontend reads the token+email from the URL and POSTs to /api/v1/auth/password/reset
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $frontend = rtrim(env('FRONTEND_URL', config('app.url')), '/');
            return "{$frontend}/reset-password?token={$token}&email=" . urlencode($notifiable->getEmailForPasswordReset());
        });
    }
}

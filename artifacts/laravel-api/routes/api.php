<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\EmailOtpController;
use App\Http\Controllers\Api\V1\Auth\MfaController;
use App\Http\Controllers\Api\V1\Auth\PasswordController;
use App\Http\Controllers\Api\V1\Auth\SocialAuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\PlatformController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Middleware\EnsurePlatformAdminKey;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ── Public / infrastructure ───────────────────────────────────────────────
    Route::get('/health', [HealthController::class, 'check'])->name('api.v1.health');
    Route::get('/version', [HealthController::class, 'version'])->name('api.v1.version');
    Route::get('/platform/plans', [PlatformController::class, 'plans'])->name('api.v1.platform.plans');

    // ── Auth — unauthenticated ─────────────────────────────────────────────────
    Route::prefix('auth')->group(function () {

        Route::post('/register', [AuthController::class, 'register'])
            ->middleware('throttle:10,1')
            ->name('api.v1.auth.register');

        Route::post('/login', [AuthController::class, 'login'])
            ->middleware('throttle:5,1')
            ->name('api.v1.auth.login');

        // Password reset
        Route::post('/password/forgot', [PasswordController::class, 'forgot'])
            ->middleware('throttle:5,1')
            ->name('api.v1.auth.password.forgot');

        Route::post('/password/reset', [PasswordController::class, 'reset'])
            ->middleware('throttle:5,1')
            ->name('api.v1.auth.password.reset');

        // MFA challenge (consumes mfa_token from login)
        Route::post('/mfa/verify', [MfaController::class, 'verify'])
            ->middleware('throttle:10,1')
            ->name('api.v1.auth.mfa.verify');

        // Email OTP (fallback MFA channel)
        Route::post('/email-otp/send', [EmailOtpController::class, 'send'])
            ->middleware('throttle:3,1')
            ->name('api.v1.auth.email_otp.send');

        Route::post('/email-otp/verify', [EmailOtpController::class, 'verify'])
            ->middleware('throttle:10,1')
            ->name('api.v1.auth.email_otp.verify');

        // Email verification (signed URL sent in registration email)
        Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
            ->middleware(['signed', 'throttle:6,1'])
            ->name('verification.verify');

        // OAuth
        Route::get('/social/{provider}', [SocialAuthController::class, 'redirect'])
            ->name('api.v1.auth.social.redirect');

        Route::get('/social/{provider}/callback', [SocialAuthController::class, 'callback'])
            ->name('api.v1.auth.social.callback');
    });

    // ── Auth — authenticated ───────────────────────────────────────────────────
    Route::middleware(['auth:sanctum', 'account.not.locked'])->group(function () {

        // Session
        Route::post('/auth/logout', [AuthController::class, 'logout'])
            ->name('api.v1.auth.logout');

        Route::post('/auth/logout-all', [AuthController::class, 'logoutAll'])
            ->name('api.v1.auth.logout_all');

        Route::get('/auth/me', [AuthController::class, 'me'])
            ->name('api.v1.auth.me');

        Route::post('/auth/email/verify-resend', [AuthController::class, 'resendVerification'])
            ->middleware('throttle:3,1')
            ->name('api.v1.auth.email.verify_resend');

        // Password change
        Route::post('/auth/password/change', [PasswordController::class, 'change'])
            ->name('api.v1.auth.password.change');

        // MFA management
        Route::prefix('auth/mfa')->group(function () {
            Route::get('/setup', [MfaController::class, 'setup'])
                ->name('api.v1.auth.mfa.setup');

            Route::post('/setup/confirm', [MfaController::class, 'confirmSetup'])
                ->name('api.v1.auth.mfa.setup.confirm');

            Route::delete('/', [MfaController::class, 'disable'])
                ->name('api.v1.auth.mfa.disable');

            Route::post('/backup-codes/regenerate', [MfaController::class, 'regenerateBackupCodes'])
                ->name('api.v1.auth.mfa.backup_codes.regenerate');
        });
    });

    // ── Platform admin (requires X-Platform-Key) ──────────────────────────────
    Route::middleware(['throttle:20,1', EnsurePlatformAdminKey::class])->group(function () {
        Route::post('/tenants', [TenantController::class, 'store'])
            ->name('api.v1.tenants.store');

        Route::get('/tenants/{tenant}', [TenantController::class, 'show'])
            ->name('api.v1.tenants.show');
    });
});

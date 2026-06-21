<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\EmailOtpController;
use App\Http\Controllers\Api\V1\Auth\MfaController;
use App\Http\Controllers\Api\V1\Auth\PasswordController;
use App\Http\Controllers\Api\V1\Auth\SocialAuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\PlatformController;
use App\Http\Controllers\Api\V1\Billing\BillingController;
use App\Http\Controllers\Api\V1\Billing\StripeWebhookController;
use App\Http\Controllers\Api\V1\Rbac\FieldPermissionController;
use App\Http\Controllers\Api\V1\Rbac\PermissionController;
use App\Http\Controllers\Api\V1\Rbac\RoleController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Controllers\Api\V1\Tenant\TenantSettingsController;
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
    // tenant.permissions resolves the active team context from X-Tenant-ID so
    // permission middleware is always team-scoped on every endpoint.
    // check_quota enforces per-tenant API call, user, and storage limits on
    // every authenticated request, based on the active subscription plan.
    Route::middleware(['auth:sanctum', 'account.not.locked', 'tenant.permissions', 'check_quota'])->group(function () {

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

        // Tenant profile / onboarding settings
        Route::patch('/tenant/profile', [TenantSettingsController::class, 'update'])
            ->name('api.v1.tenant.profile.update');

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

        // ── RBAC — tenant-scoped ───────────────────────────────────────────────
        // tenant.permissions is already on the parent group; RBAC routes just
        // add per-route permission guards via the permission: middleware alias.

        // Current user's permissions in active tenant
        Route::get('/my-permissions', [PermissionController::class, 'userPermissions'])
            ->name('api.v1.rbac.my_permissions');

        // Permissions (read + grant/revoke)
        Route::get('/permissions', [PermissionController::class, 'index'])
            ->middleware('permission:permissions.view')
            ->name('api.v1.rbac.permissions.index');

        Route::get('/permissions/{permissionId}', [PermissionController::class, 'show'])
            ->middleware('permission:permissions.view')
            ->name('api.v1.rbac.permissions.show');

        Route::post('/permissions/grant', [PermissionController::class, 'grantToUser'])
            ->middleware('permission:permissions.assign')
            ->name('api.v1.rbac.permissions.grant');

        Route::post('/permissions/revoke', [PermissionController::class, 'revokeFromUser'])
            ->middleware('permission:permissions.assign')
            ->name('api.v1.rbac.permissions.revoke');

        // Roles CRUD + assignment
        Route::get('/roles', [RoleController::class, 'index'])
            ->middleware('permission:roles.view')
            ->name('api.v1.rbac.roles.index');

        Route::post('/roles', [RoleController::class, 'store'])
            ->middleware('permission:roles.create')
            ->name('api.v1.rbac.roles.store');

        Route::get('/roles/{roleId}', [RoleController::class, 'show'])
            ->middleware('permission:roles.view')
            ->name('api.v1.rbac.roles.show');

        Route::patch('/roles/{roleId}', [RoleController::class, 'update'])
            ->middleware('permission:roles.update')
            ->name('api.v1.rbac.roles.update');

        Route::delete('/roles/{roleId}', [RoleController::class, 'destroy'])
            ->middleware('permission:roles.delete')
            ->name('api.v1.rbac.roles.destroy');

        Route::post('/roles/{roleId}/assign', [RoleController::class, 'assignToUser'])
            ->middleware('permission:roles.assign')
            ->name('api.v1.rbac.roles.assign');

        Route::post('/roles/{roleId}/remove', [RoleController::class, 'removeFromUser'])
            ->middleware('permission:roles.assign')
            ->name('api.v1.rbac.roles.remove');

        // Field permissions — premium plan feature (ai_features gate) + RBAC permission guard.
        // Field-level access control is only available on Professional and above plans.
        Route::get('/roles/{roleId}/field-permissions', [FieldPermissionController::class, 'index'])
            ->middleware(['plan_feature:ai_features', 'permission:field_permissions.manage'])
            ->name('api.v1.rbac.field_permissions.index');

        Route::put('/roles/{roleId}/field-permissions', [FieldPermissionController::class, 'upsert'])
            ->middleware(['plan_feature:ai_features', 'permission:field_permissions.manage'])
            ->name('api.v1.rbac.field_permissions.upsert');

        Route::delete('/roles/{roleId}/field-permissions/{fieldPermId}', [FieldPermissionController::class, 'destroy'])
            ->middleware(['plan_feature:ai_features', 'permission:field_permissions.manage'])
            ->name('api.v1.rbac.field_permissions.destroy');
    });

    // ── Billing — authenticated tenant routes ─────────────────────────────────
    Route::middleware(['auth:sanctum', 'account.not.locked', 'tenant.permissions'])
        ->prefix('billing')
        ->group(function () {
            // Read access — any tenant member with billing.view
            Route::get('/subscription', [BillingController::class, 'subscription'])
                ->middleware('permission:billing.view')
                ->name('api.v1.billing.subscription');

            Route::get('/invoices', [BillingController::class, 'invoiceList'])
                ->middleware('permission:billing.view')
                ->name('api.v1.billing.invoices.index');

            // Write / action access — tenant admin/owner with billing.manage
            Route::post('/checkout', [BillingController::class, 'checkout'])
                ->middleware('permission:billing.manage')
                ->name('api.v1.billing.checkout');

            Route::post('/portal', [BillingController::class, 'portal'])
                ->middleware('permission:billing.manage')
                ->name('api.v1.billing.portal');

            Route::get('/invoices/{invoiceId}/download', [BillingController::class, 'downloadInvoice'])
                ->middleware('permission:billing.view')
                ->name('api.v1.billing.invoices.download');
        });

    // ── Invoice PDF serve — signed temporary URL, no auth required ───────────
    // The download endpoint generates a signed URL pointing here.
    // Laravel ValidateSignature middleware verifies the signature + expiry.
    Route::get('/billing/invoices/{tenantId}/{invoiceId}/serve', [BillingController::class, 'serveInvoicePdf'])
        ->middleware('signed')
        ->name('api.v1.billing.invoices.serve');

    // ── Stripe webhook — no auth, Cashier verifies signature ─────────────────
    Route::post('/stripe/webhook', [StripeWebhookController::class, 'handleWebhook'])
        ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
        ->name('api.v1.stripe.webhook');

    // ── Platform admin (requires X-Platform-Key) ──────────────────────────────
    Route::middleware(['throttle:20,1', EnsurePlatformAdminKey::class])->group(function () {
        Route::post('/tenants', [TenantController::class, 'store'])
            ->name('api.v1.tenants.store');

        Route::get('/tenants/{tenant}', [TenantController::class, 'show'])
            ->name('api.v1.tenants.show');
    });
});

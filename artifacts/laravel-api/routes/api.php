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
use App\Http\Controllers\Api\V1\Tenant\TeamMembersController;
use App\Http\Controllers\Api\V1\Admin\AdminStatsController;
use App\Http\Controllers\Api\V1\Admin\AdminTenantsController;
use App\Http\Controllers\Api\V1\Admin\AdminUsersController;
use App\Http\Controllers\Api\V1\Admin\AdminPlansController;
use App\Http\Controllers\Api\V1\Admin\AdminAuditLogController;
use App\Http\Controllers\Api\V1\Admin\AdminSettingsController;
use App\Http\Controllers\Api\V1\Admin\AdminModuleController;
use App\Http\Controllers\Api\V1\DynamicRecordController;
use App\Http\Controllers\Api\V1\PublicSettingsController;
use App\Http\Middleware\EnsurePlatformAdminKey;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ── Public / infrastructure ───────────────────────────────────────────────
    Route::get('/health', [HealthController::class, 'check'])->name('api.v1.health');
    Route::get('/version', [HealthController::class, 'version'])->name('api.v1.version');
    Route::get('/platform/plans', [PlatformController::class, 'plans'])->name('api.v1.platform.plans');

    // Enabled modules list — requires auth so tenant context is available
    Route::middleware(['auth:sanctum', 'account.not.locked'])->group(function () {
        Route::get('/platform/modules', [PlatformController::class, 'modules'])->name('api.v1.platform.modules');
        Route::get('/platform/modules/{slug}', [PlatformController::class, 'moduleDetail'])->name('api.v1.platform.modules.show');
    });

    // Public platform settings (is_public=true rows only — no auth required)
    Route::get('/settings/public', [PublicSettingsController::class, 'index'])
        ->middleware('throttle:60,1')
        ->name('api.v1.settings.public');

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

        // Team members — returns users belonging to the active tenant.
        // Used by dynamic form user_picker fields; no special permission
        // required beyond being an authenticated member of the tenant.
        Route::get('/team/members', [TeamMembersController::class, 'index'])
            ->name('api.v1.team.members.index');

        // Tenant profile / onboarding settings (restricted to admins / settings managers)
        Route::patch('/tenant/profile', [TenantSettingsController::class, 'update'])
            ->middleware('permission:settings.update')
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

    // ── Dynamic module records — authenticated tenant routes ──────────────────
    Route::middleware(['auth:sanctum', 'account.not.locked', 'tenant.permissions'])
        ->prefix('m/{slug}')
        ->group(function () {
            Route::get('/stats',              [DynamicRecordController::class, 'stats'])->name('api.v1.m.stats');
            Route::get('/records/export',     [DynamicRecordController::class, 'export'])->name('api.v1.m.records.export');
            Route::get('/records',            [DynamicRecordController::class, 'index'])->name('api.v1.m.records.index');
            Route::post('/records',           [DynamicRecordController::class, 'store'])->name('api.v1.m.records.store');
            Route::delete('/records',         [DynamicRecordController::class, 'bulkDestroy'])->name('api.v1.m.records.bulk-destroy');
            Route::get('/records/{id}',       [DynamicRecordController::class, 'show'])->name('api.v1.m.records.show');
            Route::put('/records/{id}',       [DynamicRecordController::class, 'update'])->name('api.v1.m.records.update');
            Route::delete('/records/{id}',    [DynamicRecordController::class, 'destroy'])->name('api.v1.m.records.destroy');
        });

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

    // ── Authenticated super-admin / platform-admin routes ─────────────────────
    // Protected by auth:sanctum + RequireAdminAccess (sets team=central and
    // checks for the super-admin or platform-admin role).
    // Note: tenant.permissions / check_quota are intentionally omitted —
    // admin users operate in the central scope, not in a tenant context.
    Route::middleware(['auth:sanctum', 'account.not.locked', 'require.admin', 'throttle:60,1'])
        ->prefix('admin')
        ->group(function () {

            // KPI dashboard stats
            Route::get('/stats', [AdminStatsController::class, 'index'])
                ->name('api.v1.admin.stats');

            // Tenant management
            Route::get('/tenants', [AdminTenantsController::class, 'index'])
                ->name('api.v1.admin.tenants.index');

            Route::get('/tenants/{tenantId}', [AdminTenantsController::class, 'show'])
                ->name('api.v1.admin.tenants.show');

            Route::patch('/tenants/{tenantId}/status', [AdminTenantsController::class, 'updateStatus'])
                ->name('api.v1.admin.tenants.status');

            Route::patch('/tenants/{tenantId}/plan', [AdminTenantsController::class, 'changePlan'])
                ->name('api.v1.admin.tenants.plan');

            Route::post('/tenants/{tenantId}/impersonate', [AdminTenantsController::class, 'impersonate'])
                ->name('api.v1.admin.tenants.impersonate');

            // Cross-tenant user management
            Route::get('/users', [AdminUsersController::class, 'index'])
                ->name('api.v1.admin.users.index');

            Route::post('/users/{userId}/reset-password', [AdminUsersController::class, 'resetPassword'])
                ->name('api.v1.admin.users.reset_password');

            // Subscription plan management
            Route::get('/plans', [AdminPlansController::class, 'index'])
                ->name('api.v1.admin.plans.index');

            Route::patch('/plans/{planId}', [AdminPlansController::class, 'update'])
                ->name('api.v1.admin.plans.update');

            // Audit log viewer + CSV export
            Route::get('/audit-logs', [AdminAuditLogController::class, 'index'])
                ->name('api.v1.admin.audit_logs.index');

            // Platform settings
            Route::get('/settings', [AdminSettingsController::class, 'index'])
                ->name('api.v1.admin.settings.index');

            Route::patch('/settings', [AdminSettingsController::class, 'update'])
                ->name('api.v1.admin.settings.update');

            Route::post('/settings/smtp-test', [AdminSettingsController::class, 'smtpTest'])
                ->name('api.v1.admin.settings.smtp_test');

            // Dynamic Module Builder
            Route::get('/modules',                                         [AdminModuleController::class, 'index'])->name('api.v1.admin.modules.index');
            Route::post('/modules',                                        [AdminModuleController::class, 'store'])->name('api.v1.admin.modules.store');
            Route::get('/modules/{id}',                                    [AdminModuleController::class, 'show'])->name('api.v1.admin.modules.show');
            Route::put('/modules/{id}',                                    [AdminModuleController::class, 'update'])->name('api.v1.admin.modules.update');
            Route::delete('/modules/{id}',                                 [AdminModuleController::class, 'destroy'])->name('api.v1.admin.modules.destroy');
            Route::patch('/modules/{id}/toggle',                           [AdminModuleController::class, 'toggle'])->name('api.v1.admin.modules.toggle');
            Route::post('/modules/{id}/fields',                            [AdminModuleController::class, 'storeField'])->name('api.v1.admin.modules.fields.store');
            Route::put('/modules/{id}/fields/{fieldId}',                   [AdminModuleController::class, 'updateField'])->name('api.v1.admin.modules.fields.update');
            Route::delete('/modules/{id}/fields/{fieldId}',                [AdminModuleController::class, 'destroyField'])->name('api.v1.admin.modules.fields.destroy');
            Route::post('/modules/{id}/fields/reorder',                    [AdminModuleController::class, 'reorderFields'])->name('api.v1.admin.modules.fields.reorder');
        });

    // One-time impersonation token exchange — no admin auth required.
    // Protected by the one-time exchange code (60s TTL, single use via Cache::pull).
    Route::post('/admin/impersonate/exchange', [AdminTenantsController::class, 'exchange'])
        ->middleware(['throttle:20,1'])
        ->name('api.v1.admin.impersonate.exchange');
});

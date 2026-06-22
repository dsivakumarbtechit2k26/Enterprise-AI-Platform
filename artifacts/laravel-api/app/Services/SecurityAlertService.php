<?php

declare(strict_types=1);

namespace App\Services;

use App\Mail\SuspiciousActivityAlert;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SecurityAlertService
{
    // Cache key prefix for cooldown tracking.
    private const COOLDOWN_PREFIX = 'security_alert:';

    // Fallback cooldown if the platform setting is missing or zero.
    private const DEFAULT_COOLDOWN_MINUTES = 30;

    public function __construct(private readonly PlatformSettingsService $settings) {}

    /**
     * Alert when a user's consecutive failed login count meets or exceeds the threshold.
     * Called after every failed password attempt so the service decides whether to fire.
     */
    public function checkLoginFailureThreshold(User $user, string $ipAddress): void
    {
        $threshold = (int) $this->settings->get('security.login_failure_threshold', 3);

        if ($threshold <= 0 || $user->failed_login_count < $threshold) {
            return;
        }

        // Only alert at exact threshold — not on every subsequent failure
        if ($user->failed_login_count !== $threshold) {
            return;
        }

        $adminEmail = $this->resolveAdminEmail();
        if (! $adminEmail) {
            Log::warning('SecurityAlertService: no admin alert email configured; skipping login failure alert', [
                'user_id' => $user->id,
                'count'   => $user->failed_login_count,
            ]);
            return;
        }

        $this->send($adminEmail, 'login_failure', [
            'user'          => $user,
            'failure_count' => $user->failed_login_count,
            'threshold'     => $threshold,
            'ip_address'    => $ipAddress,
        ]);
    }

    /**
     * Alert when an account lock is detected (auth.login.locked).
     */
    public function alertAccountLocked(User $user, string $ipAddress): void
    {
        if (! $this->settings->get('security.alert_on_account_lock', true)) {
            return;
        }

        $adminEmail = $this->resolveAdminEmail();
        if (! $adminEmail) {
            Log::warning('SecurityAlertService: no admin alert email configured; skipping account lock alert', [
                'user_id' => $user->id,
            ]);
            return;
        }

        $this->send($adminEmail, 'account_locked', [
            'user'       => $user,
            'ip_address' => $ipAddress,
        ]);
    }

    /**
     * Alert on a payment failure event. Optional — disabled by default.
     */
    public function alertPaymentFailed(Tenant $tenant, string $invoiceId, int $attemptCount): void
    {
        if (! $this->settings->get('security.alert_on_payment_failure', false)) {
            return;
        }

        $adminEmail = $this->resolveAdminEmail();
        if (! $adminEmail) {
            Log::warning('SecurityAlertService: no admin alert email configured; skipping payment failure alert', [
                'tenant_id' => $tenant->id,
            ]);
            return;
        }

        $this->send($adminEmail, 'payment_failed', [
            'tenant'        => $tenant,
            'invoice_id'    => $invoiceId,
            'attempt_count' => $attemptCount,
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Resolve the admin alert email from platform settings, falling back to the
     * configured mail from-address (typically the platform owner's address).
     */
    private function resolveAdminEmail(): ?string
    {
        $configured = $this->settings->get('security.admin_alert_email');
        if ($configured) {
            return (string) $configured;
        }

        $fromAddress = config('mail.from.address');
        return $fromAddress ?: null;
    }

    /**
     * Resolve a stable subject identifier for the cooldown cache key.
     *
     * For user-scoped alerts this is the user's primary key.
     * For tenant-scoped alerts (payment_failed) this is the tenant's UUID.
     * Falls back to 'global' when neither is present so platform-wide alerts
     * are still deduplicated.
     */
    private function resolveSubjectKey(array $context): string
    {
        $user   = $context['user']   ?? null;
        $tenant = $context['tenant'] ?? null;

        if ($user instanceof User) {
            return (string) $user->getKey();
        }

        if ($tenant instanceof Tenant) {
            return (string) $tenant->getKey();
        }

        return 'global';
    }

    /**
     * Return true when an identical alert was already sent within the configured
     * cooldown window, and mark the cooldown key as "sent" otherwise.
     *
     * Cache key format: security_alert:{alertType}:{subjectKey}
     *
     * The cooldown window is read from the security.alert_cooldown_minutes
     * platform setting (default 30 minutes).  A value of 0 disables
     * rate-limiting entirely.
     */
    private function isCoolingDown(string $alertType, array $context): bool
    {
        $minutes = (int) $this->settings->get(
            'security.alert_cooldown_minutes',
            self::DEFAULT_COOLDOWN_MINUTES,
        );

        // Zero means no cooldown — always send.
        if ($minutes <= 0) {
            return false;
        }

        $cacheKey = self::COOLDOWN_PREFIX . $alertType . ':' . $this->resolveSubjectKey($context);

        if (Cache::has($cacheKey)) {
            return true;
        }

        // Mark as "recently sent" for the duration of the cooldown window.
        Cache::put($cacheKey, true, now()->addMinutes($minutes));

        return false;
    }

    /**
     * Persist a security.alert.fired audit log entry then attempt email delivery.
     *
     * The cooldown check runs first: if a matching alert was sent within the
     * configured window the email is suppressed and only a log line is written
     * (no audit row, no email).  This prevents alert storms from brute-force
     * attacks flooding the admin inbox.
     *
     * The audit record is written before the email attempt so that:
     *   - The alert is always traceable even if mail delivery fails.
     *   - Admins can review history in the console without relying on email archives.
     *
     * Eloquent model instances in $context are serialized to a safe scalar
     * snapshot (id, email, name) so the JSON column stays readable.
     */
    private function send(string $to, string $alertType, array $context): void
    {
        // ── Cooldown guard ────────────────────────────────────────────────────
        if ($this->isCoolingDown($alertType, $context)) {
            Log::info('SecurityAlertService: alert suppressed by cooldown', [
                'alert_type' => $alertType,
                'subject'    => $this->resolveSubjectKey($context),
            ]);
            return;
        }

        // ── Extract IDs for the audit log before sanitising the context ───────
        $user   = $context['user']   ?? null;
        $tenant = $context['tenant'] ?? null;

        $actorId   = $user   instanceof User   ? $user->id   : null;
        $tenantId  = $tenant instanceof Tenant ? (string) $tenant->id : null;
        $ipAddress = isset($context['ip_address']) && is_string($context['ip_address'])
            ? $context['ip_address']
            : null;

        // Flatten Eloquent models to scalar snapshots so new_values is JSON-safe.
        $safeContext = array_map(
            fn ($v) => $v instanceof Model
                ? array_filter(['id' => $v->getKey(), 'name' => $v->name ?? null, 'email' => $v->email ?? null])
                : $v,
            $context,
        );

        AuditLog::record(
            event: 'security.alert.fired',
            newValues: array_merge(['alert_type' => $alertType, 'notified_email' => $to], $safeContext),
            tenantId: $tenantId,
            actorId: $actorId,
            ipAddress: $ipAddress,
        );

        try {
            Mail::to($to)->send(new SuspiciousActivityAlert($alertType, $context));
            Log::info('SecurityAlertService: alert sent', [
                'type' => $alertType,
                'to'   => $to,
            ]);
        } catch (\Throwable $e) {
            Log::error('SecurityAlertService: failed to send alert email', [
                'alert_type' => $alertType,
                'to'         => $to,
                'error'      => $e->getMessage(),
            ]);
        }
    }
}

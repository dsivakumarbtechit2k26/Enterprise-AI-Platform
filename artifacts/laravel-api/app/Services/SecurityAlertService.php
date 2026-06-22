<?php

declare(strict_types=1);

namespace App\Services;

use App\Mail\SuspiciousActivityAlert;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SecurityAlertService
{
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

    private function send(string $to, string $alertType, array $context): void
    {
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

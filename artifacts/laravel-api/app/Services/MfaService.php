<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\MfaOtpToken;
use App\Models\User;
use App\Notifications\EmailOtpNotification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class MfaService
{
    public function __construct(private readonly Google2FA $google2fa) {}

    // ── TOTP ─────────────────────────────────────────────────────────────────

    public function generateTotpSecret(): string
    {
        return $this->google2fa->generateSecretKey();
    }

    public function generateQrCodeUrl(User $user, string $secret): string
    {
        return $this->google2fa->getQRCodeUrl(
            config('app.name', 'Platform'),
            $user->email,
            $secret,
        );
    }

    public function verifyTotpCode(string $secret, string $code): bool
    {
        return (bool) $this->google2fa->verifyKey($secret, $code, 1);
    }

    public function generateBackupCodes(): array
    {
        return collect(range(1, 8))
            ->map(fn () => strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4)))
            ->all();
    }

    public function verifyBackupCode(User $user, string $code): bool
    {
        $codes = $user->mfa_backup_codes ?? [];
        $code  = strtoupper(trim($code));

        foreach ($codes as $i => $stored) {
            if ($stored === $code) {
                unset($codes[$i]);
                $user->update(['mfa_backup_codes' => array_values($codes)]);
                return true;
            }
        }

        return false;
    }

    // ── Email OTP ────────────────────────────────────────────────────────────

    public function sendEmailOtp(User $user): void
    {
        // Invalidate any existing unused OTPs
        MfaOtpToken::where('user_id', $user->id)
            ->where('type', 'email')
            ->where('used', false)
            ->delete();

        $otp  = (string) random_int(100000, 999999);
        $hash = Hash::make($otp);

        MfaOtpToken::create([
            'user_id'    => $user->id,
            'token_hash' => $hash,
            'type'       => 'email',
            'expires_at' => now()->addMinutes(10),
        ]);

        $user->notify(new EmailOtpNotification($otp));
    }

    public function verifyEmailOtp(User $user, string $otp): bool
    {
        $record = MfaOtpToken::where('user_id', $user->id)
            ->where('type', 'email')
            ->where('used', false)
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (! $record || ! Hash::check($otp, $record->token_hash)) {
            return false;
        }

        $record->update(['used' => true]);
        return true;
    }
}

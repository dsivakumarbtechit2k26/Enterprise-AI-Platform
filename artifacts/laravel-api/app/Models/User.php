<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Auth\MustVerifyEmail;
use Illuminate\Contracts\Auth\MustVerifyEmail as MustVerifyEmailContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements MustVerifyEmailContract
{
    use HasApiTokens, HasFactory, HasRoles, MustVerifyEmail, Notifiable;

    protected $connection = 'central';

    // Guard name used by spatie/laravel-permission
    protected string $guard_name = 'sanctum';

    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar',
        'email_verified_at',
        'last_login_at',
        'failed_login_count',
        'locked_until',
        'mfa_enabled',
        'mfa_secret',
        'mfa_backup_codes',
        'current_tenant_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'mfa_secret',
        'mfa_backup_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'  => 'datetime',
            'last_login_at'      => 'datetime',
            'locked_until'       => 'datetime',
            'mfa_enabled'        => 'boolean',
            'mfa_backup_codes'   => 'encrypted:array',
            'password'           => 'hashed',
        ];
    }

    // ── Relations ────────────────────────────────────────────────────────────

    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    public function passwordHistory(): HasMany
    {
        return $this->hasMany(UserPasswordHistory::class)->latest();
    }

    // ── Lockout ───────────────────────────────────────────────────────────────

    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    public function incrementFailedLogin(): void
    {
        $count = $this->failed_login_count + 1;
        $data  = ['failed_login_count' => $count];

        if ($count >= 5) {
            $data['locked_until'] = now()->addMinutes(15);
        }

        $this->update($data);
    }

    public function clearFailedLogins(): void
    {
        $this->update([
            'failed_login_count' => 0,
            'locked_until'       => null,
            'last_login_at'      => now(),
        ]);
    }

    // ── Password history ─────────────────────────────────────────────────────

    public function isPasswordInHistory(string $plaintext): bool
    {
        return $this->passwordHistory()
            ->take(5)
            ->get()
            ->contains(fn ($h) => Hash::check($plaintext, $h->password_hash));
    }

    public function addPasswordToHistory(string $hash): void
    {
        $this->passwordHistory()->create(['password_hash' => $hash]);

        // Keep only last 5
        $ids = $this->passwordHistory()->skip(5)->pluck('id');
        if ($ids->isNotEmpty()) {
            UserPasswordHistory::whereIn('id', $ids)->delete();
        }
    }
}

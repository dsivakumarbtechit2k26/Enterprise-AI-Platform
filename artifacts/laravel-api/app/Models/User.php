<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $connection = 'central';

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
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'locked_until' => 'datetime',
            'mfa_enabled' => 'boolean',
            'mfa_backup_codes' => 'encrypted:array',
            'password' => 'hashed',
        ];
    }
}

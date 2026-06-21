<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MfaOtpToken extends Model
{
    protected $connection = 'central';

    protected $fillable = ['user_id', 'token_hash', 'type', 'expires_at', 'used'];

    protected $casts = ['expires_at' => 'datetime', 'used' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialAccount extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'user_id',
        'provider',
        'provider_id',
        'provider_token',
        'provider_refresh_token',
    ];

    protected $hidden = ['provider_token', 'provider_refresh_token'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

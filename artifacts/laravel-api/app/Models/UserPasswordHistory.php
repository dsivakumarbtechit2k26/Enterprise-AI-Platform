<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPasswordHistory extends Model
{
    protected $connection = 'central';
    protected $table = 'user_password_history';

    protected $fillable = ['user_id', 'password_hash'];

    protected $hidden = ['password_hash'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

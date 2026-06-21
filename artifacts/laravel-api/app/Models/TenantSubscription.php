<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Laravel\Cashier\Subscription;

/**
 * Extends Cashier's Subscription model to use polymorphic billable ownership
 * (billable_type + billable_id) instead of the default user_id column.
 */
class TenantSubscription extends Subscription
{
    protected $connection = 'central';
    protected $table = 'subscriptions';

    protected $guarded = [];

    public function billable(): MorphTo
    {
        return $this->morphTo();
    }

    public function owner(): BelongsTo
    {
        return $this->billable();
    }
}

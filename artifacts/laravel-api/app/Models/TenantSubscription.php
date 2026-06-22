<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Laravel\Cashier\Cashier;
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

    /**
     * Override the parent items() relationship to pin the foreign-key column
     * to 'subscription_id' — the column name used in the subscription_items
     * migration. Without this, Laravel auto-derives 'tenant_subscription_id'
     * from the class name, which does not exist in the table.
     */
    public function items(): HasMany
    {
        return $this->hasMany(Cashier::$subscriptionItemModel, 'subscription_id');
    }
}

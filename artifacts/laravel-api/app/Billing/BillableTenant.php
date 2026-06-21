<?php

declare(strict_types=1);

namespace App\Billing;

use App\Models\TenantSubscription;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Laravel\Cashier\Billable;

/**
 * Custom Billable trait for the Tenant model.
 * Extends Cashier's Billable but points subscriptions at the polymorphic
 * billable_type/billable_id columns instead of user_id.
 */
trait BillableTenant
{
    use Billable;

    public function subscriptions(): MorphMany
    {
        return $this->morphMany(TenantSubscription::class, 'billable');
    }

    public function subscription(string $type = 'default'): ?TenantSubscription
    {
        return $this->subscriptions->where('type', $type)->first();
    }

    public function subscribed(string $type = 'default', ?string $price = null): bool
    {
        $subscription = $this->subscription($type);
        if (! $subscription || ! $subscription->valid()) {
            return false;
        }

        return $price === null || $subscription->hasPrice($price);
    }
}

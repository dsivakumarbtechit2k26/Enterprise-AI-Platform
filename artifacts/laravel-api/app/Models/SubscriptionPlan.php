<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubscriptionPlan extends Model
{
    protected $connection = 'central';
    protected $table = 'subscription_plans';

    protected $fillable = [
        'key',
        'name',
        'description',
        'price_cents',
        'interval',
        'stripe_price_id',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active'   => 'boolean',
        'price_cents' => 'integer',
        'sort_order'  => 'integer',
    ];

    public function features(): HasMany
    {
        return $this->hasMany(PlanFeature::class, 'subscription_plan_id');
    }

    public function getFeaturesMapAttribute(): array
    {
        return $this->features
            ->pluck('feature_value', 'feature_key')
            ->toArray();
    }

    public function isFree(): bool
    {
        return in_array($this->key, ['free', 'trial'], true);
    }

    public function isPaid(): bool
    {
        return ! $this->isFree();
    }
}

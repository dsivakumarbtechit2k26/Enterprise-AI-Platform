<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanFeature extends Model
{
    protected $connection = 'central';
    protected $table = 'plan_features';

    protected $fillable = [
        'subscription_plan_id',
        'feature_key',
        'feature_value',
        'feature_type',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }
}

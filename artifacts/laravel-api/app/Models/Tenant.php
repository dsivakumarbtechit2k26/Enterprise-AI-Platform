<?php

namespace App\Models;

use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;

    protected $connection = 'central';

    protected $casts = [
        'data' => 'array',
        'trial_ends_at' => 'datetime',
        'subscription_ends_at' => 'datetime',
    ];

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'name',
            'slug',
            'status',
            'plan',
            'stripe_id',
            'trial_ends_at',
            'subscription_ends_at',
            'settings',
        ];
    }
}

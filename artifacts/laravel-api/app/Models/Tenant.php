<?php

namespace App\Models;

use App\Billing\BillableTenant;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains, BillableTenant;

    protected $connection = 'central';

    protected $casts = [
        'data'               => 'array',
        'trial_ends_at'      => 'datetime',
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
            'pm_type',
            'pm_last_four',
            'trial_ends_at',
            'subscription_ends_at',
            'settings',
        ];
    }

    public function stripeName(): string
    {
        return $this->name ?? $this->id;
    }

    public function stripeEmail(): ?string
    {
        return null;
    }

    public function getEmailForPasswordReset(): string
    {
        return '';
    }
}

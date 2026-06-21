<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;

class CustomerPolicy extends TenantPolicy
{
    protected function resource(): string
    {
        return 'customers';
    }

    /**
     * Ownership is enforced via the created_by field.
     * Users who did not create a customer record need the `customers.manage`
     * permission to update or delete it.
     */
    protected function ownerField(): ?string
    {
        return 'created_by';
    }
}
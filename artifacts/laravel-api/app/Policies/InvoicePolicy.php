<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;

class InvoicePolicy extends TenantPolicy
{
    protected function resource(): string
    {
        return 'invoices';
    }

    /**
     * Ownership is enforced via the created_by field.
     * Users who did not create an invoice need the `invoices.manage`
     * permission to update or delete it.
     */
    protected function ownerField(): ?string
    {
        return 'created_by';
    }
}
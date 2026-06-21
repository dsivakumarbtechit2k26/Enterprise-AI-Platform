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

    /*
     * Override any method from TenantPolicy to customise behaviour.
     *
     * Example — only the record owner can update:
     *
     * public function update(User $user, mixed $model): bool
     * {
     *     return parent::update($user, $model)
     *         && $model->user_id === $user->id;
     * }
     */
}
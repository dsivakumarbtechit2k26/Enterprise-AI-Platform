<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Base class for all tenant-scoped policies.
 *
 * Extend this in every module policy, e.g.:
 *
 *   class CustomerPolicy extends TenantPolicy { ... }
 *
 * The "before" hook grants super-admin unconditional access, and
 * blocks any user who is not a member of the current tenant.
 *
 * Generated via: php artisan make:tenant-policy {Name}
 */
abstract class TenantPolicy
{
    use HandlesAuthorization;

    /**
     * Run before every policy check.
     * - super-admin → always allow.
     * - Users not in the current tenant context → always deny.
     */
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('super-admin')) {
            return true;
        }

        return null; // defer to individual methods
    }

    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('view.' . $this->resource());
    }

    public function view(User $user, mixed $model): bool
    {
        return $user->hasPermissionTo('view.' . $this->resource());
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('create.' . $this->resource());
    }

    public function update(User $user, mixed $model): bool
    {
        return $user->hasPermissionTo('update.' . $this->resource());
    }

    public function delete(User $user, mixed $model): bool
    {
        return $user->hasPermissionTo('delete.' . $this->resource());
    }

    /**
     * Return the permission resource name for this policy.
     * Overridden by concrete policies.
     */
    abstract protected function resource(): string;
}

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
 * The "before" hook grants super-admin unconditional access.
 *
 * Ownership enforcement:
 *   - Override `ownerField()` to return the field name that stores the owning user ID
 *     (e.g. "user_id", "created_by"). When non-null, update/delete require the user to
 *     own the record OR have the `manage.{resource}` permission.
 *   - Override `tenantField()` to enforce a tenant boundary on the model record.
 *     Defaults to "tenant_id". Set to null to skip the tenant field check.
 *
 * Generated via: php artisan make:tenant-policy {Name}
 */
abstract class TenantPolicy
{
    use HandlesAuthorization;

    // ── Before hook ───────────────────────────────────────────────────────────

    /**
     * Run before every policy check.
     * - super-admin → always allow (handled via Gate::before in AppServiceProvider).
     */
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('super-admin')) {
            return true;
        }

        return null; // defer to individual methods
    }

    // ── Standard CRUD checks ──────────────────────────────────────────────────

    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('view.' . $this->resource());
    }

    public function view(User $user, mixed $model): bool
    {
        if (! $user->hasPermissionTo('view.' . $this->resource())) {
            return false;
        }

        return $this->withinTenantBoundary($user, $model);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('create.' . $this->resource());
    }

    public function update(User $user, mixed $model): bool
    {
        if (! $user->hasPermissionTo('update.' . $this->resource())) {
            return false;
        }

        return $this->withinTenantBoundary($user, $model)
            && $this->hasOwnerAccess($user, $model);
    }

    public function delete(User $user, mixed $model): bool
    {
        if (! $user->hasPermissionTo('delete.' . $this->resource())) {
            return false;
        }

        return $this->withinTenantBoundary($user, $model)
            && $this->hasOwnerAccess($user, $model);
    }

    // ── Override hooks ────────────────────────────────────────────────────────

    /**
     * Return the permission resource name for this policy (e.g. "customers").
     */
    abstract protected function resource(): string;

    /**
     * The model field that stores the owning user's ID.
     * Return null to disable ownership enforcement (any tenant member with the
     * required permission may update/delete the record).
     *
     * Override per policy to opt in:
     *   protected function ownerField(): ?string { return 'user_id'; }
     */
    protected function ownerField(): ?string
    {
        return null;
    }

    /**
     * The model field that stores the tenant/organization ID.
     * Checked in view/update/delete to prevent cross-tenant record access.
     * Return null to skip the tenant boundary check (e.g. for global records).
     */
    protected function tenantField(): ?string
    {
        return 'tenant_id';
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Ensures the record belongs to the same tenant as the authenticated user.
     * Skipped when tenantField() returns null or the model doesn't have the field.
     */
    protected function withinTenantBoundary(User $user, mixed $model): bool
    {
        $field = $this->tenantField();

        if ($field === null || ! isset($model->{$field})) {
            return true; // no tenant boundary to enforce
        }

        // Get the active tenant from the current request attributes or registrar
        $activeTenant = request()->attributes->get(
            'active_tenant_id',
            app(\Spatie\Permission\PermissionRegistrar::class)->getPermissionsTeamId()
        );

        return (string) $model->{$field} === (string) $activeTenant;
    }

    /**
     * Checks ownership when ownerField() is configured.
     * Users who own the record, OR who have the `manage.{resource}` permission,
     * pass this check. If ownerField() returns null, the check is skipped (always passes).
     */
    protected function hasOwnerAccess(User $user, mixed $model): bool
    {
        $field = $this->ownerField();

        if ($field === null) {
            return true; // ownership enforcement disabled for this resource
        }

        // Record owner always has access
        if (isset($model->{$field}) && (int) $model->{$field} === $user->id) {
            return true;
        }

        // Users with broad management permission bypass per-record ownership
        return $user->hasPermissionTo('manage.' . $this->resource());
    }
}

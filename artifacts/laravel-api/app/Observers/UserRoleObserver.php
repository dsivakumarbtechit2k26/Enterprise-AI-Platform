<?php

declare(strict_types=1);

namespace App\Observers;

use App\Models\User;
use Spatie\Permission\PermissionRegistrar;

/**
 * Observes User model role/permission pivot changes.
 *
 * Spatie fires these events on the User model when `assignRole`,
 * `removeRole`, `givePermissionTo`, or `revokePermissionTo` are called.
 * We tap the `roles` and `permissions` sync events to write activity log
 * entries with full actor + tenant context.
 */
class UserRoleObserver
{
    /**
     * Called after a role is attached to a user (assignRole).
     * Spatie fires `roleSynced` / custom role events via the HasRoles trait.
     * We use the generic `saved` observer as a catch-all for pivot changes.
     *
     * For role assignment, the reliable hook is `model_has_roles` pivot events.
     * We use a DB listener registered in AppServiceProvider instead of this
     * class for pivot-level changes. This observer handles broader User events.
     */
    public function saving(User $user): void
    {
        // intentionally empty — role pivot events are handled by DB listeners
    }

    /**
     * Log a role assignment event via spatie activitylog.
     *
     * Called programmatically by RbacAuditLogger (not an Eloquent event hook)
     * so that role-assignment audit entries use the same activitylog pipeline
     * as automatic model events.
     */
    public static function logRoleAssigned(
        User   $user,
        string $roleName,
        string $tenantId,
        ?User  $actor,
    ): void {
        activity('rbac')
            ->performedOn($user)
            ->causedBy($actor)
            ->withProperties([
                'role'      => $roleName,
                'tenant_id' => $tenantId,
            ])
            ->event('role.assigned')
            ->log("Role {$roleName} assigned to user {$user->id}");
    }

    /**
     * Log a role revocation event via spatie activitylog.
     */
    public static function logRoleRevoked(
        User   $user,
        string $roleName,
        string $tenantId,
        ?User  $actor,
    ): void {
        activity('rbac')
            ->performedOn($user)
            ->causedBy($actor)
            ->withProperties([
                'role'      => $roleName,
                'tenant_id' => $tenantId,
            ])
            ->event('role.revoked')
            ->log("Role {$roleName} revoked from user {$user->id}");
    }

    /**
     * Log direct permission grant via spatie activitylog.
     */
    public static function logPermissionGranted(
        User   $user,
        array  $permissions,
        string $tenantId,
        ?User  $actor,
    ): void {
        activity('rbac')
            ->performedOn($user)
            ->causedBy($actor)
            ->withProperties([
                'permissions' => $permissions,
                'tenant_id'   => $tenantId,
            ])
            ->event('permission.granted')
            ->log('Direct permissions granted to user ' . $user->id);
    }

    /**
     * Log direct permission revocation via spatie activitylog.
     */
    public static function logPermissionRevoked(
        User   $user,
        array  $permissions,
        string $tenantId,
        ?User  $actor,
    ): void {
        activity('rbac')
            ->performedOn($user)
            ->causedBy($actor)
            ->withProperties([
                'permissions' => $permissions,
                'tenant_id'   => $tenantId,
            ])
            ->event('permission.revoked')
            ->log('Direct permissions revoked from user ' . $user->id);
    }
}

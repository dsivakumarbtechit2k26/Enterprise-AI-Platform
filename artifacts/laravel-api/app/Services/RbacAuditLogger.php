<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditLog;
use App\Models\FieldPermission;
use App\Models\Role;
use App\Models\User;
use App\Observers\UserRoleObserver;

/**
 * Facade for RBAC audit logging via spatie/laravel-activitylog.
 *
 * All RBAC mutation events flow through this class, which delegates to
 * spatie's activity() helper.  The `activity_log` table (central DB) receives
 * every event with:
 *   - log_name:   'rbac'
 *   - event:      e.g. 'role.created', 'role.assigned', 'permission.granted'
 *   - subject:    the affected model (Role, FieldPermission, or User)
 *   - causer:     the authenticated actor (User)
 *   - properties: { old: {...}, attributes: {...}, tenant_id: '...' }
 *
 * Model-level events (role/permission/field-permission create/update/delete)
 * are additionally captured automatically via the LogsActivity trait on those
 * models, guaranteeing complete coverage even outside API controller paths
 * (seeders, artisan, future services).
 *
 * Failures are NOT silently swallowed: exceptions propagate to the caller.
 * Wrap the calling code in a try/catch if you need resilience, but be aware
 * that missing a security audit event should be treated as an error condition.
 */
final class RbacAuditLogger
{
    // ── Role events ───────────────────────────────────────────────────────────

    public static function roleCreated(Role $role, string $tenantId, User $actor): void
    {
        activity('rbac')
            ->performedOn($role)
            ->causedBy($actor)
            ->withProperties([
                'attributes' => ['name' => $role->name, 'team_id' => $role->team_id],
                'tenant_id'  => $tenantId,
            ])
            ->event('role.created')
            ->log("Role {$role->name} created");
    }

    public static function roleUpdated(Role $role, array $old, array $new, string $tenantId, User $actor): void
    {
        activity('rbac')
            ->performedOn($role)
            ->causedBy($actor)
            ->withProperties([
                'old'        => $old,
                'attributes' => $new,
                'tenant_id'  => $tenantId,
            ])
            ->event('role.updated')
            ->log("Role {$role->name} updated");
    }

    public static function roleDeleted(int $roleId, string $roleName, string $tenantId, User $actor): void
    {
        activity('rbac')
            ->causedBy($actor)
            ->withProperties([
                'old'       => ['id' => $roleId, 'name' => $roleName],
                'tenant_id' => $tenantId,
            ])
            ->event('role.deleted')
            ->log("Role {$roleName} deleted");
    }

    // ── Role assignment events ────────────────────────────────────────────────

    public static function roleAssigned(User $user, string $roleName, string $tenantId, User $actor): void
    {
        UserRoleObserver::logRoleAssigned($user, $roleName, $tenantId, $actor);

        AuditLog::record(
            event:     'role.assigned',
            newValues: ['role' => $roleName, 'user_id' => $user->id, 'user_email' => $user->email],
            tenantId:  $tenantId,
            actorId:   $actor->id,
        );
    }

    public static function roleRevoked(User $user, string $roleName, string $tenantId, User $actor): void
    {
        UserRoleObserver::logRoleRevoked($user, $roleName, $tenantId, $actor);

        AuditLog::record(
            event:     'role.revoked',
            oldValues: ['role' => $roleName, 'user_id' => $user->id, 'user_email' => $user->email],
            tenantId:  $tenantId,
            actorId:   $actor->id,
        );
    }

    // ── Permission events ─────────────────────────────────────────────────────

    public static function permissionsGranted(User $user, array $permissions, string $tenantId, User $actor): void
    {
        UserRoleObserver::logPermissionGranted($user, $permissions, $tenantId, $actor);

        AuditLog::record(
            event:     'permission.granted',
            newValues: ['permissions' => $permissions, 'user_id' => $user->id, 'user_email' => $user->email],
            tenantId:  $tenantId,
            actorId:   $actor->id,
        );
    }

    public static function permissionsRevoked(User $user, array $permissions, string $tenantId, User $actor): void
    {
        UserRoleObserver::logPermissionRevoked($user, $permissions, $tenantId, $actor);

        AuditLog::record(
            event:     'permission.revoked',
            oldValues: ['permissions' => $permissions, 'user_id' => $user->id, 'user_email' => $user->email],
            tenantId:  $tenantId,
            actorId:   $actor->id,
        );
    }

    // ── Field permission events ───────────────────────────────────────────────

    public static function fieldPermissionSaved(
        FieldPermission $fp,
        bool   $isNew,
        array  $old,
        string $tenantId,
        User   $actor,
    ): void {
        $event = $isNew ? 'field_permission.created' : 'field_permission.updated';

        activity('rbac')
            ->performedOn($fp)
            ->causedBy($actor)
            ->withProperties(array_filter([
                'old'        => $old ?: null,
                'attributes' => [
                    'model_class' => $fp->model_class,
                    'field_name'  => $fp->field_name,
                    'can_read'    => $fp->can_read,
                    'can_write'   => $fp->can_write,
                ],
                'tenant_id' => $tenantId,
            ]))
            ->event($event)
            ->log("{$fp->model_class}::{$fp->field_name} field permission {$event}");
    }

    public static function fieldPermissionDeleted(
        int    $id,
        array  $old,
        string $tenantId,
        User   $actor,
    ): void {
        activity('rbac')
            ->causedBy($actor)
            ->withProperties([
                'old'       => $old,
                'tenant_id' => $tenantId,
            ])
            ->event('field_permission.deleted')
            ->log("Field permission #{$id} deleted");
    }
}

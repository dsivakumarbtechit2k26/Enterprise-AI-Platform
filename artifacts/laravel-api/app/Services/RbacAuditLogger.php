<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;

/**
 * Writes RBAC mutation events to the central audit_logs table.
 *
 * Keeps the controllers thin: they call RbacAuditLogger::log(...)
 * with the actor, event name, auditable model/type+id, and context.
 */
final class RbacAuditLogger
{
    /**
     * Log an RBAC mutation to the central audit_logs table.
     *
     * @param  int|null    $actorId      The user performing the action (null = system)
     * @param  string      $event        e.g. "role.created", "role.assigned", "permission.granted"
     * @param  string      $auditableType  Class name of the affected entity
     * @param  int|string  $auditableId  ID of the affected entity
     * @param  string|null $tenantId     Active tenant scope ("central" for platform actions)
     * @param  array       $oldValues    State before change (empty for creates)
     * @param  array       $newValues    State after change (empty for deletes)
     */
    public static function log(
        ?int    $actorId,
        string  $event,
        string  $auditableType,
        int|string $auditableId,
        ?string $tenantId,
        array   $oldValues = [],
        array   $newValues = [],
    ): void {
        try {
            DB::connection('central')->table('audit_logs')->insert([
                'event'           => $event,
                'auditable_type'  => $auditableType,
                'auditable_id'    => $auditableId,
                'actor_type'      => $actorId !== null ? \App\Models\User::class : null,
                'actor_id'        => $actorId,
                'old_values'      => $oldValues ? json_encode($oldValues) : null,
                'new_values'      => $newValues ? json_encode($newValues) : null,
                'ip_address'      => Request::ip(),
                'user_agent'      => Request::userAgent(),
                'tenant_id'       => $tenantId,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
        } catch (\Throwable $e) {
            // Never let audit logging break the main request
            \Illuminate\Support\Facades\Log::warning(
                "RbacAuditLogger failed: {$e->getMessage()}",
                ['event' => $event, 'auditable_id' => $auditableId]
            );
        }
    }
}

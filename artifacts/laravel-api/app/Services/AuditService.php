<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditService
{
    public function log(
        string $event,
        ?int $actorId = null,
        string $actorType = 'user',
        ?int $auditableId = null,
        ?string $auditableType = null,
        array $oldValues = [],
        array $newValues = [],
        ?string $tenantId = null,
        ?Request $request = null
    ): void {
        try {
            DB::connection('central')->table('audit_logs')->insert([
                'event'            => $event,
                'auditable_type'   => $auditableType,
                'auditable_id'     => $auditableId,
                'actor_type'       => $actorType,
                'actor_id'         => $actorId,
                'old_values'       => $oldValues ? json_encode($oldValues) : null,
                'new_values'       => $newValues ? json_encode($newValues) : null,
                'ip_address'       => $request?->ip(),
                'user_agent'       => $request ? substr($request->userAgent() ?? '', 0, 512) : null,
                'tenant_id'        => $tenantId,
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);
        } catch (\Throwable) {
            // Audit failures must never break the main request
        }
    }

    public function logAuth(string $event, ?int $userId, ?Request $request = null, array $extra = []): void
    {
        $this->log(
            event: $event,
            actorId: $userId,
            actorType: 'user',
            auditableId: $userId,
            auditableType: 'user',
            newValues: $extra,
            request: $request,
        );
    }
}

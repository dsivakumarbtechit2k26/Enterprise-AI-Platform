<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $connection = 'central';
    protected $table      = 'audit_logs';

    protected $fillable = [
        'event',
        'auditable_type',
        'auditable_id',
        'actor_type',
        'actor_id',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
        'tenant_id',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /**
     * Write an audit-log row. Any DB/model exception is silently swallowed so
     * that a broken audit pipeline never surfaces to the caller. Consistent
     * with AuditService::log() which also has a catch-all guard.
     */
    public static function record(
        string  $event,
        array   $newValues = [],
        array   $oldValues = [],
        ?string $tenantId  = null,
        ?int    $actorId   = null,
        ?string $actorType = null,
        ?string $ipAddress = null,
    ): ?static {
        try {
            return static::create([
                'event'        => $event,
                'new_values'   => $newValues ?: null,
                'old_values'   => $oldValues ?: null,
                'tenant_id'    => $tenantId,
                'actor_id'     => $actorId,
                'actor_type'   => $actorType ?? ($actorId !== null ? User::class : null),
                'ip_address'   => $ipAddress,
            ]);
        } catch (\Throwable) {
            // Audit failures must never break the calling request.
            return null;
        }
    }
}

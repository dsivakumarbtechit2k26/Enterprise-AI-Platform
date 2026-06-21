<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class FieldPermission extends Model
{
    use LogsActivity;

    protected $connection = 'central';
    protected $table = 'field_permissions';

    protected $fillable = [
        'role_id',
        'model_class',
        'field_name',
        'can_read',
        'can_write',
        'team_id',
    ];

    protected function casts(): array
    {
        return [
            'can_read'  => 'boolean',
            'can_write' => 'boolean',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontLogEmptyChanges()
            ->useLogName('rbac')
            ->setDescriptionForEvent(fn (string $eventName) => "FieldPermission {$eventName}");
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DynamicModuleRecord extends Model
{
    protected $connection = 'central';
    protected $table      = 'dynamic_module_records';

    protected $fillable = [
        'module_id',
        'tenant_id',
        'data',
        'created_by',
    ];

    protected $casts = [
        'data' => 'array',
    ];

    public function module(): BelongsTo
    {
        return $this->belongsTo(DynamicModule::class, 'module_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

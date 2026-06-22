<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DynamicModuleField extends Model
{
    protected $connection = 'central';
    protected $table      = 'dynamic_module_fields';

    protected $fillable = [
        'module_id',
        'name',
        'label',
        'field_type',
        'options',
        'is_required',
        'show_in_list',
        'show_in_form',
        'sort_order',
    ];

    protected $casts = [
        'options'      => 'array',
        'is_required'  => 'boolean',
        'show_in_list' => 'boolean',
        'show_in_form' => 'boolean',
        'sort_order'   => 'integer',
    ];

    public function module(): BelongsTo
    {
        return $this->belongsTo(DynamicModule::class, 'module_id');
    }
}

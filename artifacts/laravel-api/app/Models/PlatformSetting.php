<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformSetting extends Model
{
    protected $connection = 'central';
    protected $table      = 'platform_settings';

    protected $fillable = ['key', 'value', 'type', 'group', 'description', 'is_public'];

    protected $casts = [
        'is_public' => 'boolean',
    ];

    public function getTypedValue(): mixed
    {
        return match ($this->type) {
            'boolean' => filter_var($this->value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $this->value,
            'json'    => json_decode($this->value ?? '{}', true),
            default   => $this->value,
        };
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $setting = static::where('key', $key)->first();
        return $setting ? $setting->getTypedValue() : $default;
    }

    public static function set(
        string $key,
        mixed  $value,
        string $type  = 'string',
        string $group = 'general',
    ): void {
        $rawValue = is_array($value) ? json_encode($value) : (string) $value;
        static::updateOrCreate(
            ['key' => $key],
            ['value' => $rawValue, 'type' => $type, 'group' => $group],
        );
    }
}

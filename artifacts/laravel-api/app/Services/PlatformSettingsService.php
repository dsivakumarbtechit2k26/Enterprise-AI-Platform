<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PlatformSettingsService
{
    private const CACHE_TTL = 3600; // 1 hour
    private const CACHE_KEY = 'platform_settings_all';

    public function get(string $key, mixed $default = null): mixed
    {
        $settings = $this->all();
        return $settings[$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        DB::connection('central')->table('platform_settings')
            ->updateOrInsert(
                ['key' => $key],
                [
                    'value'      => is_array($value) ? json_encode($value) : (string) $value,
                    'type'       => is_array($value) ? 'json' : (is_bool($value) ? 'boolean' : 'string'),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

        $this->clearCache();
    }

    public function all(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            try {
                $rows = DB::connection('central')->table('platform_settings')->get();
                $settings = [];
                foreach ($rows as $row) {
                    $settings[$row->key] = match ($row->type) {
                        'boolean' => (bool) $row->value,
                        'integer' => (int) $row->value,
                        'json'    => json_decode($row->value, true),
                        default   => $row->value,
                    };
                }
                return $settings;
            } catch (\Throwable) {
                return [];
            }
        });
    }

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}

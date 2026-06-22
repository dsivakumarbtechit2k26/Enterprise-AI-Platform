<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Platform-wide configuration stored in the `platform_settings` table.
 *
 * Caching strategy:
 * ─────────────────
 * `get()` caches individual settings in the configured cache store (Redis in
 * production, database/file elsewhere) with a short TTL. Eloquent model events
 * (`saved`, `deleted`) flush the per-key cache entry whenever a row changes, so
 * all workers sharing the same cache backend pick up changes immediately without
 * waiting for the TTL to expire.
 *
 * If the cache backend is unavailable the helpers fall back to direct DB reads
 * and writes so the application keeps working in degraded mode.
 */
class PlatformSetting extends Model
{
    protected $connection = 'central';
    protected $table      = 'platform_settings';

    protected $fillable = ['key', 'value', 'type', 'group', 'description', 'is_public'];

    protected $casts = [
        'is_public' => 'boolean',
    ];

    /** Cache key prefix — change this string to invalidate all cached settings globally. */
    public const CACHE_PREFIX = 'platform_setting::';

    /** How long individual settings are cached (seconds). */
    public const CACHE_TTL = 60;

    // ── Model events ─────────────────────────────────────────────────────────

    /**
     * Register model-event hooks so the cache is automatically invalidated
     * on every write — regardless of which code path performs the write.
     */
    protected static function booted(): void
    {
        static::saved(fn (self $setting) => static::forgetCached($setting->key));
        static::deleted(fn (self $setting) => static::forgetCached($setting->key));
    }

    // ── Typed value helper ────────────────────────────────────────────────────

    public function getTypedValue(): mixed
    {
        return match ($this->type) {
            'boolean' => filter_var($this->value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $this->value,
            'json'    => json_decode($this->value ?? '{}', true),
            default   => $this->value,
        };
    }

    // ── Cache-aware static helpers ────────────────────────────────────────────

    /**
     * Retrieve a typed setting value, caching the result for CACHE_TTL seconds.
     *
     * Falls back to a direct DB read if the cache backend is unavailable.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $cacheKey = self::CACHE_PREFIX . $key;

        try {
            return Cache::remember(
                $cacheKey,
                self::CACHE_TTL,
                function () use ($key, $default): mixed {
                    $setting = static::where('key', $key)->first();
                    return $setting !== null ? $setting->getTypedValue() : $default;
                },
            );
        } catch (\Throwable) {
            // Cache backend unavailable — read directly from DB.
            $setting = static::where('key', $key)->first();
            return $setting !== null ? $setting->getTypedValue() : $default;
        }
    }

    /**
     * Flush the cached value for a single key.
     *
     * Called automatically by the `saved` and `deleted` model events.
     * Can also be called explicitly when an external process changes a setting.
     */
    public static function forgetCached(string $key): void
    {
        try {
            Cache::forget(self::CACHE_PREFIX . $key);
        } catch (\Throwable) {
            // Non-fatal: the TTL will eventually expire and the cache
            // will self-heal on the next request.
        }
    }

    /**
     * Upsert a setting and immediately invalidate its cache entry.
     *
     * The cache invalidation happens via the `saved` model event registered
     * in booted(), so this method does not need to call forgetCached() itself.
     */
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
        // Cache is flushed by the `saved` model event above.
    }
}

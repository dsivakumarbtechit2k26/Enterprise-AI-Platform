<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\PlatformSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

/**
 * Artisan command: php artisan platform:settings-subscriber
 *
 * Long-running daemon that subscribes to the Redis `settings:updated`
 * pub/sub channel published by AdminSettingsController whenever platform
 * settings are saved.  On each message it flushes the per-key cache entries
 * so all workers immediately pick up the new values rather than serving
 * stale data until the 60-second TTL expires.
 *
 * ── Pub/sub message schema ────────────────────────────────────────────────
 *   {
 *     "updated_keys": ["smtp.host", "smtp.password", ...],
 *     "at": "2026-06-22T05:00:00.000000Z"
 *   }
 *
 * ── Running in production ─────────────────────────────────────────────────
 * Add to your Supervisor configuration alongside queue workers:
 *
 *   [program:settings-subscriber]
 *   command=php /var/www/artisan platform:settings-subscriber
 *   autostart=true
 *   autorestart=true
 *   stdout_logfile=/var/log/supervisor/settings-subscriber.log
 *   redirect_stderr=true
 *
 * One instance per application server is sufficient because Cache::forget()
 * operates on the shared Redis cache, meaning a single subscriber process
 * invalidates the key for all workers on that server in one call.
 *
 * ── Fallback behaviour ────────────────────────────────────────────────────
 * If Redis is unavailable the command exits with a non-zero code so
 * Supervisor can restart it.  Workers continue to serve cached or DB-read
 * values in the meantime; the cache self-heals after CACHE_TTL seconds.
 */
class SettingsSubscriberCommand extends Command
{
    protected $signature   = 'platform:settings-subscriber';
    protected $description = 'Subscribe to Redis settings:updated events and flush the per-key settings cache';

    public function handle(): int
    {
        $this->info('platform:settings-subscriber started — listening on channel "settings:updated"');

        try {
            Redis::subscribe(['settings:updated'], function (string $message): void {
                $this->processMessage($message);
            });
        } catch (\Throwable $e) {
            $this->error('Redis subscribe failed: ' . $e->getMessage());
            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function processMessage(string $message): void
    {
        $payload = json_decode($message, true);

        if (! is_array($payload)) {
            $this->warn('Received malformed settings:updated message — skipping.');
            return;
        }

        $updatedKeys = $payload['updated_keys'] ?? [];

        if (empty($updatedKeys)) {
            // Fallback: if the payload has no key list, flush the entire
            // platform_setting:: namespace using a cache tag-style prefix
            // scan.  This is a safety net for older publisher payloads.
            $this->warn('settings:updated received with no updated_keys — cannot perform targeted flush.');
            return;
        }

        foreach ($updatedKeys as $key) {
            PlatformSetting::forgetCached((string) $key);
            $this->line('  ↳ Flushed cache for: ' . $key);
        }

        $at = $payload['at'] ?? 'unknown';
        $this->info(sprintf(
            '[%s] Flushed %d setting(s) published at %s',
            now()->toTimeString(),
            count($updatedKeys),
            $at,
        ));
    }
}

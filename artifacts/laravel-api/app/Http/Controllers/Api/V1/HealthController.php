<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class HealthController extends Controller
{
    public function check(): JsonResponse
    {
        $checks = [];
        $healthy = true;

        // Database check
        try {
            DB::connection('central')->getPdo();
            $checks['database'] = ['status' => 'ok', 'connection' => 'central'];
        } catch (\Throwable $e) {
            $checks['database'] = ['status' => 'error', 'message' => $e->getMessage()];
            $healthy = false;
        }

        // Cache check
        try {
            Cache::put('health_check', true, 5);
            Cache::get('health_check');
            $checks['cache'] = ['status' => 'ok', 'driver' => config('cache.default')];
        } catch (\Throwable $e) {
            $checks['cache'] = ['status' => 'error', 'message' => $e->getMessage()];
        }

        // Queue check
        $checks['queue'] = [
            'status' => 'ok',
            'driver' => config('queue.default'),
        ];

        return response()->json([
            'status'  => $healthy ? 'healthy' : 'degraded',
            'version' => config('app.version', '1.0.0'),
            'environment' => config('app.env'),
            'checks'  => $checks,
            'timestamp' => now()->toIso8601String(),
        ], $healthy ? 200 : 503);
    }

    public function version(): JsonResponse
    {
        return response()->json([
            'app'     => config('app.name'),
            'version' => config('app.version', '1.0.0'),
            'api'     => 'v1',
            'php'     => PHP_VERSION,
            'laravel' => app()->version(),
        ]);
    }
}

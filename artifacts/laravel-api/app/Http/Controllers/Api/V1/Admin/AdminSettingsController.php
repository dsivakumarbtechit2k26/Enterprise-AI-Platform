<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class AdminSettingsController extends Controller
{
    public function index(): JsonResponse
    {
        $grouped = PlatformSetting::all()
            ->groupBy('group')
            ->map(fn ($group) => $group->mapWithKeys(fn ($s) => [
                $s->key => [
                    'value'       => $s->getTypedValue(),
                    'type'        => $s->type,
                    'description' => $s->description,
                    'is_public'   => $s->is_public,
                ],
            ]));

        return response()->json(['data' => $grouped]);
    }

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'settings' => ['required', 'array'],
        ]);

        $updated = [];

        foreach ($request->input('settings', []) as $key => $value) {
            $existing = PlatformSetting::where('key', $key)->first();

            if ($existing) {
                $raw = is_array($value) ? json_encode($value) : (string) $value;
                $existing->update(['value' => $raw]);
                $updated[$key] = $existing->getTypedValue();
            }
        }

        if (! empty($updated)) {
            AuditLog::record(
                event:     'platform_settings.updated',
                newValues: $updated,
                actorId:   $request->user()?->id,
                ipAddress: $request->ip(),
            );

            // Notify running workers to reload settings via Redis pub/sub
            try {
                Redis::publish('settings:updated', json_encode([
                    'updated_keys' => array_keys($updated),
                    'at'           => now()->toISOString(),
                ]));
            } catch (\Exception $e) {
                // Non-fatal: workers will reload settings on their next request cycle
            }
        }

        return response()->json([
            'data'    => $updated,
            'message' => 'Platform settings updated.',
        ]);
    }
}

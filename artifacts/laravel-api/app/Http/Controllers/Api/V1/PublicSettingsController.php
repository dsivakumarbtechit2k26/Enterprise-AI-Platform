<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;

/**
 * Exposes platform settings that are safe to share with unauthenticated clients.
 *
 * Only rows with is_public = true are returned.  These settings are intentionally
 * public (e.g. feature flags, OAuth provider toggles) and must never contain
 * credentials or sensitive configuration.
 *
 * The response is a flat key → typed-value map so the frontend can do a simple
 * key lookup without traversing a group hierarchy.
 *
 * Rate-limited to 60 requests/minute to prevent enumeration abuse.
 */
class PublicSettingsController extends Controller
{
    public function index(): JsonResponse
    {
        $settings = PlatformSetting::where('is_public', true)
            ->get()
            ->mapWithKeys(fn (PlatformSetting $s) => [$s->key => $s->getTypedValue()]);

        return response()->json(['data' => $settings]);
    }
}

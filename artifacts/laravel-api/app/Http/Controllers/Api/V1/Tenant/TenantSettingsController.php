<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantSettingsController extends Controller
{
    /**
     * Update the current tenant's profile / onboarding metadata.
     * Route is guarded by permission:settings.update — only tenant admins
     * and users with explicit settings management access may call this.
     * Settings are merged (not replaced) into the tenant's JSON settings column.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'      => ['sometimes', 'string', 'max:255'],
            'industry'  => ['sometimes', 'string', 'max:255'],
            'team_size' => ['sometimes', 'string', 'max:50'],
        ]);

        /** @var \App\Models\User $user */
        $user   = $request->user();
        $tenant = $user->tenant;

        if (!$tenant) {
            return response()->json(['message' => 'Tenant not found.'], 404);
        }

        if (isset($validated['name'])) {
            $tenant->name = $validated['name'];
        }

        $settings = $tenant->settings ?? [];

        if (isset($validated['industry'])) {
            $settings['industry'] = $validated['industry'];
        }

        if (isset($validated['team_size'])) {
            $settings['team_size'] = $validated['team_size'];
        }

        $tenant->settings = $settings;
        $tenant->save();

        return response()->json([
            'message'  => 'Tenant profile updated.',
            'name'     => $tenant->name,
            'settings' => $settings,
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
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

    /**
     * Send a test email using the currently saved SMTP settings.
     * On success → 200; on SMTP failure → 422 with the error message.
     */
    public function smtpTest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to' => ['required', 'email', 'max:254'],
        ]);

        // Load current SMTP settings from platform_settings table (fall back to .env)
        $s = PlatformSetting::whereIn('key', [
            'smtp.host', 'smtp.port', 'smtp.username', 'smtp.password', 'smtp.encryption',
            'mail.from_address', 'mail.from_name',
        ])->pluck('value', 'key');

        config([
            'mail.default'                     => 'smtp',
            'mail.mailers.smtp.host'            => $s->get('smtp.host',        config('mail.mailers.smtp.host')),
            'mail.mailers.smtp.port'            => (int) ($s->get('smtp.port', config('mail.mailers.smtp.port', 587))),
            'mail.mailers.smtp.username'        => $s->get('smtp.username',    config('mail.mailers.smtp.username')),
            'mail.mailers.smtp.password'        => $s->get('smtp.password',    config('mail.mailers.smtp.password')),
            'mail.mailers.smtp.encryption'      => $s->get('smtp.encryption',  config('mail.mailers.smtp.encryption', 'tls')),
            'mail.from.address'                 => $s->get('mail.from_address', config('mail.from.address', 'noreply@example.com')),
            'mail.from.name'                    => $s->get('mail.from_name',    config('mail.from.name', 'Platform')),
        ]);

        // Force a fresh mailer instance so it picks up the runtime config change
        app()->forgetInstance('mailer');
        app()->forgetInstance('swift.mailer');

        try {
            Mail::raw(
                "This is a test email from your Enterprise Platform.\n\n"
                . "SMTP is configured correctly.\n\n"
                . "Sent: " . now()->toISOString(),
                function ($msg) use ($validated): void {
                    $msg->to($validated['to'])
                        ->subject('[Platform] SMTP Test Email');
                },
            );

            AuditLog::record(
                event:     'platform_settings.smtp_test',
                newValues: ['to' => $validated['to'], 'result' => 'success'],
                actorId:   $request->user()?->id,
                ipAddress: $request->ip(),
            );

            return response()->json([
                'data'    => ['sent_to' => $validated['to']],
                'message' => "Test email dispatched to {$validated['to']}.",
            ]);
        } catch (\Exception $e) {
            AuditLog::record(
                event:     'platform_settings.smtp_test',
                newValues: ['to' => $validated['to'], 'result' => 'failed', 'error' => $e->getMessage()],
                actorId:   $request->user()?->id,
                ipAddress: $request->ip(),
            );

            return response()->json([
                'message' => 'SMTP test failed: ' . $e->getMessage(),
            ], 422);
        }
    }
}

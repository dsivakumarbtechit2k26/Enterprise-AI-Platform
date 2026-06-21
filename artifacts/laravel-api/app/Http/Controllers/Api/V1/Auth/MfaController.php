<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaPendingSession;
use App\Services\AuditService;
use App\Services\MfaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class MfaController extends Controller
{
    public function __construct(
        private readonly MfaService $mfa,
        private readonly AuditService $audit,
    ) {}

    // ── GET /api/v1/auth/mfa/setup ────────────────────────────────────────────
    // Returns a new TOTP secret + QR code URL. The caller stores the secret
    // and sends it back with the first TOTP code to confirm setup.

    public function setup(Request $request): JsonResponse
    {
        $user   = $request->user();
        $secret = $this->mfa->generateTotpSecret();
        $qrUrl  = $this->mfa->generateQrCodeUrl($user, $secret);

        // Cache the pending secret keyed by user for 10 minutes
        cache()->put('mfa_setup:' . $user->id, $secret, now()->addMinutes(10));

        return response()->json([
            'data' => [
                'secret' => $secret,
                'qr_url' => $qrUrl,
            ],
        ]);
    }

    // ── POST /api/v1/auth/mfa/setup/confirm ───────────────────────────────────
    // Confirms TOTP setup by verifying the first code against the cached secret.

    public function confirmSetup(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string', 'size:6']]);

        $user   = $request->user();
        $secret = cache()->get('mfa_setup:' . $user->id);

        if (! $secret) {
            return response()->json([
                'type'   => 'https://platform.local/errors/mfa-setup-not-started',
                'title'  => 'MFA Setup Not Started',
                'status' => Response::HTTP_BAD_REQUEST,
                'detail' => 'Start MFA setup first using GET /api/v1/auth/mfa/setup.',
            ], Response::HTTP_BAD_REQUEST);
        }

        if (! $this->mfa->verifyTotpCode($secret, $request->code)) {
            return response()->json([
                'type'   => 'https://platform.local/errors/invalid-mfa-code',
                'title'  => 'Invalid MFA Code',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'The provided TOTP code is incorrect.',
                'errors' => ['code' => ['Invalid TOTP code.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $backupCodes = $this->mfa->generateBackupCodes();
        $user->update([
            'mfa_enabled'      => true,
            'mfa_secret'       => encrypt($secret),
            'mfa_backup_codes' => $backupCodes,
        ]);

        cache()->forget('mfa_setup:' . $user->id);
        $this->audit->logAuth('auth.mfa.enabled', $user->id, $request);

        return response()->json([
            'data' => ['backup_codes' => $backupCodes],
            'message' => 'MFA enabled successfully. Store your backup codes in a safe place.',
        ]);
    }

    // ── DELETE /api/v1/auth/mfa ───────────────────────────────────────────────
    // Disables MFA after verifying password.

    public function disable(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string', 'current_password'],
        ]);

        $user = $request->user();
        $user->update([
            'mfa_enabled'      => false,
            'mfa_secret'       => null,
            'mfa_backup_codes' => null,
        ]);

        $this->audit->logAuth('auth.mfa.disabled', $user->id, $request);

        return response()->json(['message' => 'MFA disabled successfully.']);
    }

    // ── POST /api/v1/auth/mfa/verify ─────────────────────────────────────────
    // Completes MFA login challenge. Consumes an mfa_token issued at login.

    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'mfa_token' => ['required', 'string'],
            'code'      => ['required', 'string'],
        ]);

        $pending = MfaPendingSession::where('token', hash('sha256', $request->mfa_token))
            ->where('expires_at', '>', now())
            ->first();

        if (! $pending) {
            return response()->json([
                'type'   => 'https://platform.local/errors/invalid-mfa-token',
                'title'  => 'Invalid or Expired MFA Token',
                'status' => Response::HTTP_UNAUTHORIZED,
                'detail' => 'The MFA token is invalid or has expired. Please log in again.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $user   = $pending->user;
        $code   = trim($request->code);
        $secret = decrypt($user->mfa_secret);

        $valid = $this->mfa->verifyTotpCode($secret, $code)
            || $this->mfa->verifyBackupCode($user, $code);

        if (! $valid) {
            $this->audit->logAuth('auth.mfa.verify.failed', $user->id, $request);
            return response()->json([
                'type'   => 'https://platform.local/errors/invalid-mfa-code',
                'title'  => 'Invalid MFA Code',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'The provided MFA code is incorrect.',
                'errors' => ['code' => ['Invalid MFA code.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $pending->delete();
        $user->clearFailedLogins();

        $this->audit->logAuth('auth.login.success', $user->id, $request, ['via' => 'mfa']);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'data' => [
                'user'  => $this->userResource($user),
                'token' => $token,
            ],
            'message' => 'MFA verified. Login successful.',
        ]);
    }

    // ── POST /api/v1/auth/mfa/backup-codes/regenerate ─────────────────────────

    public function regenerateBackupCodes(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string', 'current_password'],
        ]);

        $user        = $request->user();
        $backupCodes = $this->mfa->generateBackupCodes();
        $user->update(['mfa_backup_codes' => $backupCodes]);

        $this->audit->logAuth('auth.mfa.backup_codes.regenerated', $user->id, $request);

        return response()->json(['data' => ['backup_codes' => $backupCodes]]);
    }

    private function userResource(\App\Models\User $user): array
    {
        return [
            'id'                => $user->id,
            'name'              => $user->name,
            'email'             => $user->email,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'mfa_enabled'       => $user->mfa_enabled,
            'avatar'            => $user->avatar,
            'last_login_at'     => $user->last_login_at?->toIso8601String(),
            'created_at'        => $user->created_at?->toIso8601String(),
        ];
    }
}

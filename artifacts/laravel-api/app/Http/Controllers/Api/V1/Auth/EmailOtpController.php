<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaPendingSession;
use App\Models\User;
use App\Services\AuditService;
use App\Services\MfaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EmailOtpController extends Controller
{
    public function __construct(
        private readonly MfaService $mfa,
        private readonly AuditService $audit,
    ) {}

    // ── POST /api/v1/auth/email-otp/send ──────────────────────────────────────
    // Sends an email OTP to the user. Requires an mfa_token from the login step.

    public function send(Request $request): JsonResponse
    {
        $request->validate(['mfa_token' => ['required', 'string']]);

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

        $this->mfa->sendEmailOtp($pending->user);
        $this->audit->logAuth('auth.email_otp.sent', $pending->user_id, $request);

        return response()->json(['message' => 'OTP sent to your registered email address.']);
    }

    // ── POST /api/v1/auth/email-otp/verify ────────────────────────────────────
    // Verifies email OTP and completes login.

    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'mfa_token' => ['required', 'string'],
            'otp'       => ['required', 'string', 'size:6'],
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

        $user = $pending->user;

        if (! $this->mfa->verifyEmailOtp($user, $request->otp)) {
            $this->audit->logAuth('auth.email_otp.verify.failed', $user->id, $request);
            return response()->json([
                'type'   => 'https://platform.local/errors/invalid-otp',
                'title'  => 'Invalid OTP',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'The provided OTP is invalid or has expired.',
                'errors' => ['otp' => ['Invalid or expired OTP.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $pending->delete();
        $user->clearFailedLogins();

        $this->audit->logAuth('auth.login.success', $user->id, $request, ['via' => 'email_otp']);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'data' => [
                'user'  => $this->userResource($user),
                'token' => $token,
            ],
            'message' => 'Email OTP verified. Login successful.',
        ]);
    }

    private function userResource(User $user): array
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

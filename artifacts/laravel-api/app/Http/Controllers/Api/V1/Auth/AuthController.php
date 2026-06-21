<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaPendingSession;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    public function __construct(private readonly AuditService $audit) {}

    // ── POST /api/v1/auth/register ────────────────────────────────────────────

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'unique:central.users,email'],
            'password' => ['required', 'confirmed', $this->passwordRule()],
        ]);

        $user = User::create([
            'name'     => $validated['name'],
            'email'    => strtolower($validated['email']),
            'password' => $validated['password'],
        ]);

        // Save initial password to history
        $user->addPasswordToHistory($user->password);

        // Send email verification notification
        $user->sendEmailVerificationNotification();

        $this->audit->logAuth('user.registered', $user->id, $request);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'data' => [
                'user'  => $this->userResource($user),
                'token' => $token,
            ],
            'message' => 'Registration successful. Please verify your email address.',
        ], Response::HTTP_CREATED);
    }

    // ── POST /api/v1/auth/login ───────────────────────────────────────────────

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower($validated['email']))->first();

        // Unknown user — don't reveal existence
        if (! $user) {
            return $this->invalidCredentialsResponse();
        }

        // Locked account
        if ($user->isLocked()) {
            $this->audit->logAuth('auth.login.locked', $user->id, $request);
            return response()->json([
                'type'         => 'https://platform.local/errors/account-locked',
                'title'        => 'Account Locked',
                'status'       => Response::HTTP_FORBIDDEN,
                'detail'       => 'Account temporarily locked due to too many failed attempts.',
                'locked_until' => $user->locked_until?->toIso8601String(),
            ], Response::HTTP_FORBIDDEN);
        }

        // Wrong password
        if (! Hash::check($validated['password'], $user->password)) {
            $user->incrementFailedLogin();
            $this->audit->logAuth('auth.login.failed', $user->id, $request, ['reason' => 'invalid_password']);
            return $this->invalidCredentialsResponse();
        }

        $user->clearFailedLogins();

        // MFA required
        if ($user->mfa_enabled) {
            $rawToken = Str::random(64);

            MfaPendingSession::create([
                'user_id'    => $user->id,
                'token'      => hash('sha256', $rawToken), // store hash, never plaintext
                'expires_at' => now()->addMinutes(10),
            ]);

            $this->audit->logAuth('auth.login.mfa_required', $user->id, $request);

            return response()->json([
                'data' => [
                    'mfa_required' => true,
                    'mfa_token'    => $rawToken, // return plaintext to client
                ],
                'message' => 'MFA verification required.',
            ], Response::HTTP_OK);
        }

        $this->audit->logAuth('auth.login.success', $user->id, $request);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'data' => [
                'user'  => $this->userResource($user),
                'token' => $token,
            ],
            'message' => 'Login successful.',
        ]);
    }

    // ── POST /api/v1/auth/logout ──────────────────────────────────────────────

    public function logout(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        // Revoke PAT when using Bearer token auth (currentAccessToken() is null in SPA cookie mode)
        $pat = $request->user()->currentAccessToken();
        if ($pat) {
            $pat->delete();
        }

        // Invalidate session when using SPA cookie auth
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        \Illuminate\Support\Facades\Auth::guard('web')->logout();

        $this->audit->logAuth('auth.logout', $userId, $request);

        return response()->json(['message' => 'Logged out successfully.']);
    }

    // ── POST /api/v1/auth/logout-all ─────────────────────────────────────────

    public function logoutAll(Request $request): JsonResponse
    {
        // Revoke all PATs
        $request->user()->tokens()->delete();

        // Also invalidate session if in SPA cookie mode
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        \Illuminate\Support\Facades\Auth::guard('web')->logout();

        $this->audit->logAuth('auth.logout.all_sessions', $request->user()->id, $request);

        return response()->json(['message' => 'All sessions terminated.']);
    }

    // ── GET /api/v1/auth/me ───────────────────────────────────────────────────

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->userResource($request->user())]);
    }

    // ── GET /api/v1/auth/email/verify/{id}/{hash} ─────────────────────────────

    public function verifyEmail(Request $request, int $id, string $hash): JsonResponse
    {
        $user = User::findOrFail($id);

        // Validate hash against the user's email
        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return response()->json([
                'type'   => 'https://platform.local/errors/invalid-verification-link',
                'title'  => 'Invalid Verification Link',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'The email verification link is invalid.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }

        $user->markEmailAsVerified();
        $this->audit->logAuth('auth.email.verified', $user->id, $request);

        return response()->json(['message' => 'Email verified successfully.']);
    }

    // ── POST /api/v1/auth/email/verify-resend ────────────────────────────────

    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }

        $user->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification email sent.']);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

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

    private function invalidCredentialsResponse(): JsonResponse
    {
        return response()->json([
            'type'   => 'https://platform.local/errors/invalid-credentials',
            'title'  => 'Invalid Credentials',
            'status' => Response::HTTP_UNAUTHORIZED,
            'detail' => 'The provided credentials are incorrect.',
        ], Response::HTTP_UNAUTHORIZED);
    }

    private function passwordRule(): \Illuminate\Validation\Rules\Password
    {
        return Password::min(10)
            ->mixedCase()
            ->numbers()
            ->symbols()
            ->uncompromised(3);
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Symfony\Component\HttpFoundation\Response;

class PasswordController extends Controller
{
    public function __construct(private readonly AuditService $audit) {}

    // ── POST /api/v1/auth/password/forgot ─────────────────────────────────────

    public function forgot(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        // Always return success to prevent user enumeration
        Password::sendResetLink($request->only('email'));

        return response()->json([
            'message' => 'If that email address exists, a password reset link has been sent.',
        ]);
    }

    // ── POST /api/v1/auth/password/reset ──────────────────────────────────────

    public function reset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token'    => ['required', 'string'],
            'email'    => ['required', 'email'],
            'password' => ['required', 'confirmed', $this->passwordRule()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use ($request): void {
                if ($user->isPasswordInHistory($password)) {
                    throw new \RuntimeException('password_reuse');
                }

                $hash = Hash::make($password);
                $user->forceFill(['password' => $hash, 'remember_token' => Str::random(60)]);
                $user->save();
                $user->addPasswordToHistory($hash);

                // Revoke all tokens on password reset
                $user->tokens()->delete();
                event(new PasswordReset($user));

                $this->audit->logAuth('auth.password.reset', $user->id, $request);
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Password reset successfully.']);
        }

        return response()->json([
            'type'   => 'https://platform.local/errors/password-reset-failed',
            'title'  => 'Password Reset Failed',
            'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
            'detail' => __($status),
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    // ── POST /api/v1/auth/password/change ─────────────────────────────────────

    public function change(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'confirmed', $this->passwordRule()],
        ]);

        $user = $request->user();

        if (! Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'type'   => 'https://platform.local/errors/invalid-credentials',
                'title'  => 'Invalid Credentials',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'The current password is incorrect.',
                'errors' => ['current_password' => ['The current password is incorrect.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($user->isPasswordInHistory($validated['password'])) {
            return response()->json([
                'type'   => 'https://platform.local/errors/password-reuse',
                'title'  => 'Password Reuse Detected',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'You cannot reuse one of your last 5 passwords.',
                'errors' => ['password' => ['You cannot reuse one of your last 5 passwords.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $hash = Hash::make($validated['password']);
        $user->update(['password' => $hash]);
        $user->addPasswordToHistory($hash);

        $this->audit->logAuth('auth.password.changed', $user->id, $request);

        return response()->json(['message' => 'Password changed successfully.']);
    }

    private function passwordRule(): PasswordRule
    {
        return PasswordRule::min(10)
            ->mixedCase()
            ->numbers()
            ->symbols()
            ->uncompromised(3);
    }
}

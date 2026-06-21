<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\SocialAccount;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\Response;

class SocialAuthController extends Controller
{
    private const ALLOWED_PROVIDERS = ['google', 'github'];

    // State tokens expire in 10 minutes (one-time use)
    private const STATE_TTL_MINUTES = 10;

    public function __construct(private readonly AuditService $audit) {}

    // ── GET /api/v1/auth/social/{provider} ────────────────────────────────────
    // Returns the OAuth redirect URL for the client. Generates a server-side
    // state token stored in cache to prevent CSRF on the callback.

    public function redirect(Request $request, string $provider): JsonResponse
    {
        $this->validateProvider($provider);

        // Generate a random state token and store it in cache
        $state = Str::random(40);
        Cache::put("oauth_state:{$state}", $provider, now()->addMinutes(self::STATE_TTL_MINUTES));

        $url = Socialite::driver($provider)
            ->stateless()
            ->with(['state' => $state])
            ->redirect()
            ->getTargetUrl();

        return response()->json(['data' => ['redirect_url' => $url]]);
    }

    // ── GET /api/v1/auth/social/{provider}/callback ───────────────────────────
    // Handles the OAuth callback. Validates the server-side state token,
    // then returns a Sanctum token.

    public function callback(Request $request, string $provider): JsonResponse
    {
        $this->validateProvider($provider);

        // Validate server-side state to prevent CSRF
        $state = $request->query('state');
        if (! $state || ! Cache::has("oauth_state:{$state}")) {
            return response()->json([
                'type'   => 'https://platform.local/errors/oauth-invalid-state',
                'title'  => 'Invalid OAuth State',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'The OAuth state parameter is missing or has expired.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Consume state token (one-time use)
        Cache::forget("oauth_state:{$state}");

        try {
            $socialUser = Socialite::driver($provider)->stateless()->user();
        } catch (\Throwable $e) {
            return response()->json([
                'type'   => 'https://platform.local/errors/oauth-failed',
                'title'  => 'OAuth Failed',
                'status' => Response::HTTP_BAD_REQUEST,
                'detail' => 'Could not authenticate with ' . ucfirst($provider) . '.',
            ], Response::HTTP_BAD_REQUEST);
        }

        if (! $socialUser->getEmail()) {
            return response()->json([
                'type'   => 'https://platform.local/errors/oauth-no-email',
                'title'  => 'Email Not Provided',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'The OAuth provider did not return an email address.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Find existing social account link
        $social = SocialAccount::where('provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        if ($social) {
            $user = $social->user;
            $social->update([
                'provider_token'         => $socialUser->token,
                'provider_refresh_token' => $socialUser->refreshToken,
            ]);
        } else {
            // Find or create user by email
            $user = User::firstOrCreate(
                ['email' => strtolower($socialUser->getEmail())],
                [
                    'name'              => $socialUser->getName() ?? $socialUser->getNickname() ?? 'User',
                    'email_verified_at' => now(), // OAuth-verified email
                    'avatar'            => $socialUser->getAvatar(),
                ]
            );

            // Link social account
            $user->socialAccounts()->create([
                'provider'               => $provider,
                'provider_id'            => $socialUser->getId(),
                'provider_token'         => $socialUser->token,
                'provider_refresh_token' => $socialUser->refreshToken,
            ]);
        }

        $user->clearFailedLogins();
        $this->audit->logAuth('auth.oauth.login', $user->id, $request, ['provider' => $provider]);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'data' => [
                'user'  => [
                    'id'                => $user->id,
                    'name'              => $user->name,
                    'email'             => $user->email,
                    'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                    'avatar'            => $user->avatar,
                    'mfa_enabled'       => $user->mfa_enabled,
                    'created_at'        => $user->created_at?->toIso8601String(),
                ],
                'token' => $token,
            ],
            'message' => 'OAuth login successful.',
        ]);
    }

    private function validateProvider(string $provider): void
    {
        if (! in_array($provider, self::ALLOWED_PROVIDERS, true)) {
            abort(Response::HTTP_NOT_FOUND, "OAuth provider '{$provider}' is not supported.");
        }
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaPendingSession;
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

    // State/verifier pairs expire in 10 minutes (one-time use)
    private const STATE_TTL_MINUTES = 10;

    public function __construct(private readonly AuditService $audit) {}

    // ── GET /api/v1/auth/social/{provider} ────────────────────────────────────
    // Returns the OAuth redirect URL + a state_verifier the client must present
    // at the callback. The server caches hash(verifier) bound to the provider,
    // so only the original requester (who holds the verifier) can complete the flow.
    // This prevents OAuth login-swap / CSRF even for stateless API callers.

    public function redirect(Request $request, string $provider): JsonResponse
    {
        $this->validateProvider($provider);

        // Generate cryptographically random state (sent to provider) + verifier (held by client)
        $state    = Str::random(40);
        $verifier = Str::random(40);

        // Store {provider, verifier_hash} — never the plaintext verifier
        Cache::put("oauth_state:{$state}", [
            'provider'      => $provider,
            'verifier_hash' => hash('sha256', $verifier),
        ], now()->addMinutes(self::STATE_TTL_MINUTES));

        $url = Socialite::driver($provider)
            ->stateless()
            ->with(['state' => $state])
            ->redirect()
            ->getTargetUrl();

        return response()->json([
            'data' => [
                'redirect_url'  => $url,
                // Client must store this and include it as ?state_verifier= in the callback request
                'state_verifier' => $verifier,
            ],
        ]);
    }

    // ── GET /api/v1/auth/social/{provider}/callback ───────────────────────────
    // Handles the OAuth provider callback. Validates:
    //   1. state exists in cache
    //   2. cached provider matches the route {provider}
    //   3. hash(state_verifier) matches the cached verifier_hash
    // Only the client that received the original redirect_url can satisfy (3).

    public function callback(Request $request, string $provider): JsonResponse
    {
        $this->validateProvider($provider);

        $state    = $request->query('state');
        $verifier = $request->query('state_verifier');

        // Retrieve cached payload without consuming yet (need to validate first)
        $cached = $state ? Cache::get("oauth_state:{$state}") : null;

        if (
            ! $state
            || ! $verifier
            || ! is_array($cached)
            || ($cached['provider'] ?? null) !== $provider
            || ! hash_equals($cached['verifier_hash'], hash('sha256', $verifier))
        ) {
            return response()->json([
                'type'   => 'https://platform.local/errors/oauth-invalid-state',
                'title'  => 'Invalid OAuth State',
                'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'detail' => 'OAuth state validation failed. The request may have been tampered with.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Atomically consume — prevents replay
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

            $user->socialAccounts()->create([
                'provider'               => $provider,
                'provider_id'            => $socialUser->getId(),
                'provider_token'         => $socialUser->token,
                'provider_refresh_token' => $socialUser->refreshToken,
            ]);
        }

        $user->clearFailedLogins();
        $this->audit->logAuth('auth.oauth.login', $user->id, $request, ['provider' => $provider]);

        // Enforce MFA challenge for MFA-enabled users — OAuth does not bypass 2FA
        if ($user->mfa_enabled) {
            $rawToken = Str::random(64);

            MfaPendingSession::create([
                'user_id'    => $user->id,
                'token'      => hash('sha256', $rawToken),
                'expires_at' => now()->addMinutes(10),
            ]);

            $this->audit->logAuth('auth.login.mfa_required', $user->id, $request, ['via' => 'oauth']);

            return response()->json([
                'data' => [
                    'mfa_required' => true,
                    'mfa_token'    => $rawToken,
                ],
                'message' => 'MFA verification required.',
            ], Response::HTTP_OK);
        }

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

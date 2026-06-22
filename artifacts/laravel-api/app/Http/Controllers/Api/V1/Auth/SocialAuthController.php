<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaPendingSession;
use App\Models\PlatformSetting;
use App\Models\SocialAccount;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\Response;

class SocialAuthController extends Controller
{
    private const ALLOWED_PROVIDERS = ['google', 'github'];

    // State tokens expire in 10 minutes (one-time use, CSRF protection)
    private const STATE_TTL_MINUTES = 10;

    public function __construct(private readonly AuditService $audit) {}

    // ── GET /api/v1/auth/social/{provider} ────────────────────────────────────
    // Validates that the provider is enabled in platform_settings, then performs
    // a server-side redirect to the OAuth provider.  The browser follows the
    // redirect chain transparently.

    public function redirect(Request $request, string $provider): Response
    {
        $this->validateProvider($provider);
        $this->assertProviderEnabled($provider);

        // Generate a random state token for CSRF protection — stored in cache
        // so the callback can verify it without relying on browser sessions.
        $state = Str::random(40);
        Cache::put(
            "oauth_state:{$state}",
            ['provider' => $provider],
            now()->addMinutes(self::STATE_TTL_MINUTES),
        );

        return Socialite::driver($provider)
            ->stateless()
            ->with(['state' => $state])
            ->redirect();
    }

    // ── GET /api/v1/auth/social/{provider}/callback ───────────────────────────
    // Handles the OAuth provider callback, validates state, finds/creates the
    // user, then redirects the browser back to the frontend SPA.

    public function callback(Request $request, string $provider): Response
    {
        $this->validateProvider($provider);
        $this->assertProviderEnabled($provider);

        $frontendBase = rtrim(env('APP_FRONTEND_URL', ''), '/');
        $callbackPath = $frontendBase . '/auth/callback';

        // ── State / CSRF validation ───────────────────────────────────────────
        $state  = $request->query('state');
        $cached = $state ? Cache::get("oauth_state:{$state}") : null;

        if (
            ! $state
            || ! is_array($cached)
            || ($cached['provider'] ?? null) !== $provider
        ) {
            return redirect($callbackPath . '?error=' . urlencode(
                'OAuth state validation failed. The request may have been tampered with.'
            ));
        }

        Cache::forget("oauth_state:{$state}"); // one-time use

        // ── Exchange code for user ────────────────────────────────────────────
        try {
            $socialUser = Socialite::driver($provider)->stateless()->user();
        } catch (\Throwable) {
            return redirect($callbackPath . '?error=' . urlencode(
                'Could not authenticate with ' . ucfirst($provider) . '. Please try again.'
            ));
        }

        if (! $socialUser->getEmail()) {
            return redirect($callbackPath . '?error=' . urlencode(
                ucfirst($provider) . ' did not provide an email address.'
            ));
        }

        // ── Find or create user ───────────────────────────────────────────────
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

        // ── MFA gate — OAuth does not bypass 2FA ─────────────────────────────
        if ($user->mfa_enabled) {
            $rawToken = Str::random(64);

            MfaPendingSession::create([
                'user_id'    => $user->id,
                'token'      => hash('sha256', $rawToken),
                'expires_at' => now()->addMinutes(10),
            ]);

            $this->audit->logAuth('auth.login.mfa_required', $user->id, $request, ['via' => 'oauth']);

            return redirect(
                $callbackPath
                . '?mfa_required=1'
                . '&mfa_token=' . urlencode($rawToken)
                . '&mfa_method=' . urlencode($user->mfa_method ?? 'totp')
            );
        }

        $token = $user->createToken('api')->plainTextToken;

        return redirect($callbackPath . '?token=' . urlencode($token));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Abort with 403 if the provider is disabled in platform_settings.
     * The admin UI hides the buttons when disabled, but this guard prevents
     * direct URL access or API bypass attempts.
     */
    private function assertProviderEnabled(string $provider): void
    {
        $enabled = PlatformSetting::get("oauth.{$provider}.enabled", false);

        if (! $enabled) {
            abort(
                Response::HTTP_FORBIDDEN,
                ucfirst($provider) . ' OAuth login is currently disabled by the platform administrator.'
            );
        }
    }

    private function validateProvider(string $provider): void
    {
        if (! in_array($provider, self::ALLOWED_PROVIDERS, true)) {
            abort(Response::HTTP_NOT_FOUND, "OAuth provider '{$provider}' is not supported.");
        }
    }
}

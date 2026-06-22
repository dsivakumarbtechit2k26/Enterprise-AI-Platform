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
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Handles OAuth social authentication via GitHub and Google.
 *
 * Security model (stateless OAuth with client-binding):
 *
 *   1. redirect(): generates a random `state` (stored in cache) and a random
 *      `verifier` (its SHA-256 hash stored alongside the state in cache).
 *      The raw verifier is placed in a short-lived httpOnly cookie on the
 *      browser, then the response redirects to the OAuth provider.
 *
 *   2. callback(): the browser follows the provider's redirect, so both the
 *      OAuth ?code+?state query params AND the cookie arrive together.  We
 *      read the verifier from the cookie, hash it, and compare against what
 *      was cached.  This binds the callback to the exact client session that
 *      initiated the flow, preventing login-CSRF / account-swap attacks where
 *      an attacker tricks a victim into opening a forged callback URL.
 *
 *   3. The provider is checked against oauth.{provider}.enabled in
 *      platform_settings in both endpoints.  Disabled providers return 403
 *      from redirect() or redirect-to-error from callback().
 */
class SocialAuthController extends Controller
{
    private const ALLOWED_PROVIDERS  = ['google', 'github'];
    private const STATE_TTL_MINUTES  = 10;
    private const COOKIE_NAME        = 'oauth_verifier';

    public function __construct(private readonly AuditService $audit) {}

    // ── GET /api/v1/auth/social/{provider} ────────────────────────────────────
    // Validates that the provider is enabled, builds a verifier-bound state,
    // sets the verifier cookie, then performs a browser redirect to the provider.

    public function redirect(Request $request, string $provider): Response
    {
        $this->validateProvider($provider);
        $this->assertProviderEnabled($provider);

        // Generate a random state (CSRF token) and a random verifier.
        // Only the SHA-256 hash of the verifier is stored server-side; the raw
        // verifier lives exclusively in the browser cookie, so an attacker who
        // can enumerate the cache cannot forge a valid callback.
        $state    = Str::random(40);
        $verifier = Str::random(64);

        Cache::put(
            "oauth_state:{$state}",
            [
                'provider'      => $provider,
                'verifier_hash' => hash('sha256', $verifier),
            ],
            now()->addMinutes(self::STATE_TTL_MINUTES),
        );

        // The verifier cookie is:
        //   - httpOnly  → not readable by JavaScript
        //   - secure    → HTTPS-only in production
        //   - SameSite=Lax → accompanies top-level navigations (the provider redirect back)
        //   - short TTL (STATE_TTL_MINUTES) → one-time window matching the state
        $cookie = Cookie::make(
            self::COOKIE_NAME,
            $verifier,
            self::STATE_TTL_MINUTES,
            '/',
            null,
            app()->isProduction(),   // secure flag
            true,                    // httpOnly
            false,
            'Lax',
        );

        return Socialite::driver($provider)
            ->stateless()
            ->with(['state' => $state])
            ->redirect()
            ->withCookie($cookie);
    }

    // ── GET /api/v1/auth/social/{provider}/callback ───────────────────────────
    // Validates state + verifier cookie (client-binding check), exchanges the
    // code for a user, then redirects the browser to the frontend SPA.

    public function callback(Request $request, string $provider): Response
    {
        $this->validateProvider($provider);
        $this->assertProviderEnabled($provider);

        $frontendBase = rtrim(env('APP_FRONTEND_URL', ''), '/');
        $callbackPath = $frontendBase . '/auth/callback';

        // ── State retrieval ───────────────────────────────────────────────────
        $state  = $request->query('state');
        $cached = $state ? Cache::get("oauth_state:{$state}") : null;

        if (! $state || ! is_array($cached) || ($cached['provider'] ?? null) !== $provider) {
            return $this->failRedirect(
                $callbackPath,
                'OAuth state validation failed. The request may have been tampered with.'
            );
        }

        // ── Verifier check (client-binding) ───────────────────────────────────
        // The browser must present the cookie set during redirect().  If the
        // cookie is absent or its hash doesn't match, the callback was not
        // initiated by the same browser session — reject it.
        $verifier = $request->cookie(self::COOKIE_NAME);

        if (! $verifier || hash('sha256', $verifier) !== ($cached['verifier_hash'] ?? '')) {
            return $this->failRedirect(
                $callbackPath,
                'OAuth session binding failed. Please restart the sign-in flow.'
            );
        }

        // Consume the state entry (one-time use) and expire the cookie.
        Cache::forget("oauth_state:{$state}");
        $expiredCookie = Cookie::forget(self::COOKIE_NAME);

        // ── Exchange code for user ────────────────────────────────────────────
        try {
            $socialUser = Socialite::driver($provider)->stateless()->user();
        } catch (\Throwable) {
            return $this->failRedirect(
                $callbackPath,
                'Could not authenticate with ' . ucfirst($provider) . '. Please try again.'
            )->withCookie($expiredCookie);
        }

        if (! $socialUser->getEmail()) {
            return $this->failRedirect(
                $callbackPath,
                ucfirst($provider) . ' did not provide an email address.'
            )->withCookie($expiredCookie);
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
                    'email_verified_at' => now(),
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
            )->withCookie($expiredCookie);
        }

        $token = $user->createToken('api')->plainTextToken;

        return redirect($callbackPath . '?token=' . urlencode($token))
            ->withCookie($expiredCookie);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Abort with 403 if the provider is disabled in platform_settings. */
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

    private function failRedirect(string $base, string $message): \Illuminate\Http\RedirectResponse
    {
        return redirect($base . '?error=' . urlencode($message));
    }
}

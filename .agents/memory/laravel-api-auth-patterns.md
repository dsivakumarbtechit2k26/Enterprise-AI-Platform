---
name: Laravel API auth patterns
description: Key patterns and gotchas for stateless Sanctum token auth in a Laravel API (no web/session), covering middleware, password reset, MFA, and model naming.
---

## The Rules

**1. Custom Authenticate middleware is required for API-only apps**
`Illuminate\Auth\Middleware\Authenticate::redirectTo()` calls `route('login')` for non-JSON requests, throwing "Route [login] not defined." Override it:
```php
class Authenticate extends Middleware {
    protected function redirectTo(Request $request): ?string { return null; }
}
```
Register in `bootstrap/app.php` as alias `'auth'`.

**2. ResetPassword URL must be configured explicitly**
Without this, the notification throws "Route [password.reset] not defined." In a ServiceProvider boot():
```php
ResetPassword::createUrlUsing(fn($notifiable, $token) => 
    env('FRONTEND_URL') . "/reset-password?token={$token}&email=" . urlencode($notifiable->email)
);
```

**3. Use cache() not $request->session() in stateless API controllers**
API routes don't have session middleware. For temporary state (MFA setup secret, etc.) use `cache()->put('key', $value, now()->addMinutes(10))`.

**4. Sanctum needs a custom PersonalAccessToken model for central connection**
```php
class PersonalAccessToken extends SanctumToken { protected $connection = 'central'; }
// In ServiceProvider: Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);
```

**5. Model table name pluralization gotcha**
`UserPasswordHistory` → Laravel pluralizes to `user_password_histories`, but table was created as `user_password_history`. Add `protected $table = 'user_password_history'` explicitly.

**6. Fortify::ignoreRoutes() prevents duplicate route conflicts**
When managing your own API routes, call `Fortify::ignoreRoutes()` in a ServiceProvider boot(). Set `'views' => false` in config/fortify.php too.

**Why:** These are all undocumented conflicts between Laravel's web-centric defaults and a pure API application without web/session middleware.

<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

/**
 * Creates (or updates) the platform-admin super-user.
 *
 * Credentials are driven by env vars so they can be changed without
 * touching code:
 *
 *   PLATFORM_ADMIN_EMAIL    (default: admin@platform.local)
 *   PLATFORM_ADMIN_PASSWORD (REQUIRED in production — no default)
 *   PLATFORM_ADMIN_NAME     (default: Platform Admin)
 *
 * ⚠  Production safety:
 *   When APP_ENV=production this seeder refuses to run if
 *   PLATFORM_ADMIN_PASSWORD is not set. This prevents the well-known
 *   fallback password from ever being active on a live system.
 *
 * Run standalone:
 *   php artisan db:seed --class=PlatformAdminSeeder
 *
 * The RbacSeeder must have been run first so the 'platform-admin' role
 * (team_id = 'central') already exists.
 */
class PlatformAdminSeeder extends Seeder
{
    public const CENTRAL_TEAM = 'central';

    /**
     * Fallback password used ONLY in non-production environments.
     * Hard-coded here (not in .env.example) so it is never silently
     * carried into a real deployment.
     */
    private const DEV_FALLBACK_PASSWORD = 'ChangeMe123!';

    public function run(): void
    {
        $isProduction = app()->environment('production');
        $rawPassword  = env('PLATFORM_ADMIN_PASSWORD');

        // ── Production guard ──────────────────────────────────────────────────
        if ($isProduction && empty($rawPassword)) {
            throw new \RuntimeException(
                'PLATFORM_ADMIN_PASSWORD must be set when APP_ENV=production. ' .
                'Refusing to seed the admin account with a default password. ' .
                'Set the env var and re-run the seeder.'
            );
        }

        // ── Non-production fallback ───────────────────────────────────────────
        if (empty($rawPassword)) {
            $rawPassword = self::DEV_FALLBACK_PASSWORD;
            $this->command->warn(
                '  PLATFORM_ADMIN_PASSWORD is not set — using dev fallback. ' .
                'Set the env var before deploying to production.'
            );
        }

        $email = env('PLATFORM_ADMIN_EMAIL', 'admin@platform.local');
        $name  = env('PLATFORM_ADMIN_NAME',  'Platform Admin');

        // Set Spatie team context to central so role assignment lands correctly.
        app(PermissionRegistrar::class)->setPermissionsTeamId(self::CENTRAL_TEAM);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::on('central')->updateOrCreate(
            ['email' => $email],
            [
                'name'              => $name,
                'password'          => Hash::make($rawPassword),
                'email_verified_at' => now(),
            ]
        );

        // Assign platform-admin role in the central team scope.
        $user->setRelation('roles', collect()); // clear cached relations
        $user->syncRoles(['platform-admin']);

        $this->command->info("✓ Platform admin ready — email: {$email}");

        if (! $isProduction) {
            $this->command->warn('  Set PLATFORM_ADMIN_PASSWORD before going to production.');
        }
    }
}
